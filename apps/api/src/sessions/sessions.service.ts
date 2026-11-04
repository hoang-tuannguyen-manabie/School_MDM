import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  DEVICE_STATUSES,
  ROLES,
  type AuthenticatedUser,
  type ClassSessionDetailDto,
  type ClassSessionDeviceDto,
  type CommandType,
  type MdmProviderType,
  type PolicyVersionDto,
} from '@school-mdm/contracts';
import {
  createClassSessionSchema,
  type CreateClassSessionInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { CommandsService } from '../commands/commands.service';
import { DevicesService } from '../devices/devices.service';
import { PoliciesService } from '../policies/policies.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SchoolRepositoryPort } from '../school/school.repository';

@Injectable()
export class SessionsService {
  private readonly sessionsById = new Map<string, ClassSessionDetailDto>();

  constructor(
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly devicesService: DevicesService,
    private readonly policiesService: PoliciesService,
    private readonly commandsService: CommandsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  async createSession(
    actor: AuthenticatedUser,
    rawInput: CreateClassSessionInput,
    now = new Date(),
    requestId = randomUUID(),
  ): Promise<ClassSessionDetailDto> {
    const parsed = createClassSessionSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu tạo phiên học không hợp lệ',
      );
    }

    const input = parsed.data;
    const schoolClass = await this.schoolRepo.findClassById(input.classId);
    if (!schoolClass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    if (!this.classScope.isAdmin(actor)) {
      const teacherClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
      this.classScope.assertCanAccessClass(actor, input.classId, teacherClassIds);
    }

    const policy = this.policiesService.getPolicyById(input.policyId);
    const targetVersionId = input.policyVersionId ?? policy.currentVersionId;
    const policyVersion = policy.versions.find((v) => v.id === targetVersionId);

    if (!policyVersion || policyVersion.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Phiên học chỉ được phép gắn với phiên bản chính sách đã xuất bản (PUBLISHED)',
      );
    }

    const classDevices = await this.devicesService.listDevices(
      actor,
      { classId: input.classId, page: 1, pageSize: 100 },
      now,
    );

    const nowIso = now.toISOString();
    const sessionId = randomUUID();

    const sessionDevices: ClassSessionDeviceDto[] = classDevices.items.map((device) => ({
      id: randomUUID(),
      sessionId,
      deviceId: device.id,
      deviceDisplayName: device.displayName,
      deviceStatus: device.status,
      syncState: 'PENDING_APPLY',
      applyCommandId: null,
      releaseCommandId: null,
      lastError: null,
      appliedAt: null,
      releasedAt: null,
      updatedAt: nowIso,
    }));

    const session: ClassSessionDetailDto = {
      id: sessionId,
      classId: input.classId,
      teacherId: actor.id,
      policyId: policy.id,
      policyVersionId: policyVersion.id,
      title: input.title,
      subjectName: input.subjectName,
      status: 'SCHEDULED',
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      actualStartedAt: null,
      actualEndedAt: null,
      notes: input.notes ?? null,
      devices: sessionDevices,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.sessionsById.set(session.id, session);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? ROLES.TEACHER,
      action: 'CLASS_SESSION_CREATED',
      targetType: 'CLASS_SESSION',
      targetId: session.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        classId: session.classId,
        policyId: session.policyId,
        policyVersionId: session.policyVersionId,
        deviceCount: sessionDevices.length,
      },
    });

    return this.cloneSession(session);
  }

  async startSession(
    actor: AuthenticatedUser,
    sessionId: string,
    options?: {
      now?: Date;
      providerTypeOverride?: MdmProviderType;
      requestId?: string;
    },
  ): Promise<ClassSessionDetailDto> {
    const now = options?.now ?? new Date();
    const nowIso = now.toISOString();
    const requestId = options?.requestId ?? randomUUID();

    const session = this.sessionsById.get(sessionId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên học');
    }

    await this.assertCanManageSession(actor, session);

    if (session.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Chỉ có thể bắt đầu phiên học đang ở trạng thái SCHEDULED (hiện tại: ${session.status})`,
      );
    }

    const policy = this.policiesService.getPolicyById(session.policyId);
    const policyVersion = policy.versions.find((v) => v.id === session.policyVersionId);
    if (!policyVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản chính sách của phiên học');
    }

    session.status = 'ACTIVE';
    session.actualStartedAt = nowIso;
    session.updatedAt = nowIso;

    // Refresh device statuses and apply policy to online devices; mark offline devices as WAITING_DEVICE_ONLINE
    for (const sessionDevice of session.devices) {
      const deviceDetail = await this.devicesService.getDeviceDetail(
        actor,
        sessionDevice.deviceId,
        now,
      );
      sessionDevice.deviceStatus = deviceDetail.status;

      if (deviceDetail.status !== DEVICE_STATUSES.ONLINE) {
        sessionDevice.syncState = 'WAITING_DEVICE_ONLINE';
        sessionDevice.lastError =
          'Thiết bị đang ngoại tuyến khi bắt đầu tiết học; hệ thống sẽ tự động áp dụng chính sách ngay khi thiết bị kết nối lại.';
        sessionDevice.updatedAt = nowIso;

        this.realtimeGateway.emitSessionDeviceUpdated({
          sessionId: session.id,
          classId: session.classId,
          deviceId: sessionDevice.deviceId,
          syncState: sessionDevice.syncState,
          lastError: sessionDevice.lastError,
        });
        continue;
      }

      await this.dispatchApplyPolicyToSessionDevice(
        actor,
        session,
        sessionDevice,
        policyVersion,
        nowIso,
        options?.providerTypeOverride,
      );
    }

    this.realtimeGateway.emitSessionStatusUpdated({
      sessionId: session.id,
      classId: session.classId,
      status: session.status,
      updatedAt: nowIso,
    });

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? ROLES.TEACHER,
      action: 'CLASS_SESSION_STARTED',
      targetType: 'CLASS_SESSION',
      targetId: session.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        classId: session.classId,
        onlineDevices: session.devices.filter((d) => d.deviceStatus === DEVICE_STATUSES.ONLINE)
          .length,
        waitingOfflineDevices: session.devices.filter(
          (d) => d.syncState === 'WAITING_DEVICE_ONLINE',
        ).length,
      },
    });

    return this.cloneSession(session);
  }

  async endSession(
    actor: AuthenticatedUser,
    sessionId: string,
    options?: {
      now?: Date;
      providerTypeOverride?: MdmProviderType;
      requestId?: string;
    },
  ): Promise<ClassSessionDetailDto> {
    const now = options?.now ?? new Date();
    const nowIso = now.toISOString();
    const requestId = options?.requestId ?? randomUUID();

    const session = this.sessionsById.get(sessionId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên học');
    }

    await this.assertCanManageSession(actor, session);

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Chỉ có thể kết thúc phiên học đang ở trạng thái ACTIVE (hiện tại: ${session.status})`,
      );
    }

    session.status = 'ENDED';
    session.actualEndedAt = nowIso;
    session.updatedAt = nowIso;

    for (const sessionDevice of session.devices) {
      const deviceDetail = await this.devicesService.getDeviceDetail(
        actor,
        sessionDevice.deviceId,
        now,
      );
      sessionDevice.deviceStatus = deviceDetail.status;

      if (deviceDetail.status !== DEVICE_STATUSES.ONLINE) {
        // Honest state: do NOT mark as RELEASED when device is offline!
        sessionDevice.syncState = 'WAITING_RELEASE_ONLINE';
        sessionDevice.lastError =
          'Thiết bị ngoại tuyến khi kết thúc tiết học; chưa thể gỡ chính sách cho tới khi thiết bị trực tuyến trở lại.';
        sessionDevice.updatedAt = nowIso;

        this.realtimeGateway.emitSessionDeviceUpdated({
          sessionId: session.id,
          classId: session.classId,
          deviceId: sessionDevice.deviceId,
          syncState: sessionDevice.syncState,
          lastError: sessionDevice.lastError,
        });
        continue;
      }

      await this.dispatchReleasePolicyToSessionDevice(
        actor,
        session,
        sessionDevice,
        nowIso,
        options?.providerTypeOverride,
      );
    }

    this.realtimeGateway.emitSessionStatusUpdated({
      sessionId: session.id,
      classId: session.classId,
      status: session.status,
      updatedAt: nowIso,
    });

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? ROLES.TEACHER,
      action: 'CLASS_SESSION_ENDED',
      targetType: 'CLASS_SESSION',
      targetId: session.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        classId: session.classId,
        releaseSentCount: session.devices.filter((d) => d.syncState === 'RELEASE_SENT').length,
        waitingOfflineReleaseCount: session.devices.filter(
          (d) => d.syncState === 'WAITING_RELEASE_ONLINE',
        ).length,
      },
    });

    return this.cloneSession(session);
  }

  /**
   * Reconciles any active or ended sessions when a previously offline tablet sends a heartbeat and comes back ONLINE.
   */
  async reconcileDeviceOnHeartbeat(
    deviceId: string,
    now = new Date(),
  ): Promise<{ reconciledSessionIds: string[] }> {
    const nowIso = now.toISOString();
    const reconciledSessionIds: string[] = [];

    const systemAdminActor: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'system@school.local',
      fullName: 'System Reconciler',
      roles: [ROLES.ADMIN],
      assignedClassIds: [],
    };

    for (const session of this.sessionsById.values()) {
      const sessionDevice = session.devices.find((d) => d.deviceId === deviceId);
      if (!sessionDevice) {
        continue;
      }

      sessionDevice.deviceStatus = DEVICE_STATUSES.ONLINE;

      if (session.status === 'ACTIVE' && sessionDevice.syncState === 'WAITING_DEVICE_ONLINE') {
        const policy = this.policiesService.getPolicyById(session.policyId);
        const policyVersion = policy.versions.find((v) => v.id === session.policyVersionId);
        if (policyVersion) {
          await this.dispatchApplyPolicyToSessionDevice(
            systemAdminActor,
            session,
            sessionDevice,
            policyVersion,
            nowIso,
          );
          reconciledSessionIds.push(session.id);
        }
      } else if (
        session.status === 'ENDED' &&
        sessionDevice.syncState === 'WAITING_RELEASE_ONLINE'
      ) {
        await this.dispatchReleasePolicyToSessionDevice(
          systemAdminActor,
          session,
          sessionDevice,
          nowIso,
        );
        reconciledSessionIds.push(session.id);
      }
    }

    return { reconciledSessionIds };
  }

  /**
   * Updates session_device state when the tablet acknowledges or completes an apply/release command.
   * Ensures a device is only marked POLICY_APPLIED or RELEASED after genuine confirmation.
   */
  async reconcileSessionDeviceOnCommandUpdate(commandId: string): Promise<void> {
    const cmd = await this.commandsService.syncCommandStatusFromProvider(commandId);
    const nowIso = new Date().toISOString();

    for (const session of this.sessionsById.values()) {
      for (const sd of session.devices) {
        if (sd.applyCommandId === cmd.id) {
          if (cmd.status === COMMAND_STATUSES.SUCCESS) {
            sd.syncState = 'POLICY_APPLIED';
            sd.appliedAt = nowIso;
            sd.lastError = null;
          } else if (
            cmd.status === COMMAND_STATUSES.FAILED ||
            cmd.status === COMMAND_STATUSES.TIMEOUT
          ) {
            sd.syncState = 'FAILED';
            sd.lastError = cmd.failureReason ?? 'Lệnh áp dụng chính sách thất bại';
          }
          sd.updatedAt = nowIso;

          this.realtimeGateway.emitSessionDeviceUpdated({
            sessionId: session.id,
            classId: session.classId,
            deviceId: sd.deviceId,
            syncState: sd.syncState,
            lastError: sd.lastError,
          });
        } else if (sd.releaseCommandId === cmd.id) {
          if (cmd.status === COMMAND_STATUSES.SUCCESS) {
            sd.syncState = 'RELEASED';
            sd.releasedAt = nowIso;
            sd.lastError = null;
          } else if (
            cmd.status === COMMAND_STATUSES.FAILED ||
            cmd.status === COMMAND_STATUSES.TIMEOUT
          ) {
            sd.syncState = 'FAILED';
            sd.lastError = cmd.failureReason ?? 'Lệnh gỡ chính sách tiết học thất bại';
          }
          sd.updatedAt = nowIso;

          this.realtimeGateway.emitSessionDeviceUpdated({
            sessionId: session.id,
            classId: session.classId,
            deviceId: sd.deviceId,
            syncState: sd.syncState,
            lastError: sd.lastError,
          });
        }
      }
    }
  }

  async listSessions(actor: AuthenticatedUser, classId?: string): Promise<ClassSessionDetailDto[]> {
    const isAdmin = this.classScope.isAdmin(actor);
    const teacherClassIds = isAdmin
      ? []
      : await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);

    if (!isAdmin && classId) {
      this.classScope.assertCanAccessClass(actor, classId, teacherClassIds);
    }

    let list = Array.from(this.sessionsById.values());
    if (!isAdmin) {
      const allowed = new Set(teacherClassIds);
      list = list.filter((s) => allowed.has(s.classId));
    }
    if (classId) {
      list = list.filter((s) => s.classId === classId);
    }

    return list.map((s) => this.cloneSession(s));
  }

  async getSessionById(
    actor: AuthenticatedUser,
    sessionId: string,
  ): Promise<ClassSessionDetailDto> {
    const session = this.sessionsById.get(sessionId);
    if (!session) {
      throw new NotFoundException('Không tìm thấy phiên học');
    }
    await this.assertCanManageSession(actor, session);
    return this.cloneSession(session);
  }

  private async dispatchApplyPolicyToSessionDevice(
    actor: AuthenticatedUser,
    session: ClassSessionDetailDto,
    sessionDevice: ClassSessionDeviceDto,
    policyVersion: PolicyVersionDto,
    nowIso: string,
    providerTypeOverride?: MdmProviderType,
  ): Promise<void> {
    let commandType: CommandType = COMMAND_TYPES.APPLY_CONFIGURATION;
    if (policyVersion.kioskModeEnabled) {
      commandType = COMMAND_TYPES.APPLY_KIOSK_POLICY;
    } else if (policyVersion.appAllowlistEnabled) {
      commandType = COMMAND_TYPES.APPLY_ALLOWLIST;
    }

    const cmd = await this.commandsService.dispatchCommand(
      actor,
      sessionDevice.deviceId,
      {
        idempotencyKey: randomUUID(),
        commandType,
        payload: {
          action: 'APPLY_SESSION_POLICY',
          sessionId: session.id,
          policyId: session.policyId,
          policyVersionId: policyVersion.id,
          kioskModeEnabled: policyVersion.kioskModeEnabled,
          kioskPackageName: policyVersion.kioskPackageName,
          appAllowlistEnabled: policyVersion.appAllowlistEnabled,
          allowedPackages: policyVersion.allowedPackages,
        },
        expiresInSeconds: 600,
      },
      {
        sessionId: session.id,
        providerTypeOverride,
      },
    );

    sessionDevice.applyCommandId = cmd.id;
    sessionDevice.updatedAt = nowIso;

    if (cmd.status === COMMAND_STATUSES.UNSUPPORTED) {
      sessionDevice.syncState = 'UNSUPPORTED';
      sessionDevice.lastError = cmd.failureReason;
    } else if (cmd.status === COMMAND_STATUSES.SUCCESS) {
      sessionDevice.syncState = 'POLICY_APPLIED';
      sessionDevice.appliedAt = nowIso;
      sessionDevice.lastError = null;
    } else if (cmd.status === COMMAND_STATUSES.FAILED) {
      sessionDevice.syncState = 'FAILED';
      sessionDevice.lastError = cmd.failureReason;
    } else {
      // Honest state: command is SENT / PENDING, waiting for tablet acknowledgment
      sessionDevice.syncState = 'POLICY_SENT';
      sessionDevice.lastError = null;
    }

    this.realtimeGateway.emitSessionDeviceUpdated({
      sessionId: session.id,
      classId: session.classId,
      deviceId: sessionDevice.deviceId,
      syncState: sessionDevice.syncState,
      lastError: sessionDevice.lastError,
    });
  }

  private async dispatchReleasePolicyToSessionDevice(
    actor: AuthenticatedUser,
    session: ClassSessionDetailDto,
    sessionDevice: ClassSessionDeviceDto,
    nowIso: string,
    providerTypeOverride?: MdmProviderType,
  ): Promise<void> {
    const cmd = await this.commandsService.dispatchCommand(
      actor,
      sessionDevice.deviceId,
      {
        idempotencyKey: randomUUID(),
        commandType: COMMAND_TYPES.APPLY_CONFIGURATION,
        payload: {
          action: 'RELEASE_SESSION_POLICY',
          sessionId: session.id,
          kioskModeEnabled: false,
          appAllowlistEnabled: false,
        },
        expiresInSeconds: 600,
      },
      {
        sessionId: session.id,
        providerTypeOverride,
      },
    );

    sessionDevice.releaseCommandId = cmd.id;
    sessionDevice.updatedAt = nowIso;

    if (cmd.status === COMMAND_STATUSES.SUCCESS) {
      sessionDevice.syncState = 'RELEASED';
      sessionDevice.releasedAt = nowIso;
      sessionDevice.lastError = null;
    } else if (
      cmd.status === COMMAND_STATUSES.FAILED ||
      cmd.status === COMMAND_STATUSES.UNSUPPORTED
    ) {
      sessionDevice.syncState = 'FAILED';
      sessionDevice.lastError = cmd.failureReason;
    } else {
      // Honest state: command is SENT, NOT yet RELEASED until device acknowledges!
      sessionDevice.syncState = 'RELEASE_SENT';
      sessionDevice.lastError = null;
    }

    this.realtimeGateway.emitSessionDeviceUpdated({
      sessionId: session.id,
      classId: session.classId,
      deviceId: sessionDevice.deviceId,
      syncState: sessionDevice.syncState,
      lastError: sessionDevice.lastError,
    });
  }

  private async assertCanManageSession(
    actor: AuthenticatedUser,
    session: ClassSessionDetailDto,
  ): Promise<void> {
    if (!this.classScope.isAdmin(actor)) {
      const teacherClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
      if (!teacherClassIds.includes(session.classId)) {
        throw new ForbiddenException(
          'Giáo viên không có quyền quản lý phiên học của lớp ngoài phạm vi được phân công.',
        );
      }
    }
  }

  private cloneSession(session: ClassSessionDetailDto): ClassSessionDetailDto {
    return {
      ...session,
      devices: session.devices.map((d) => ({ ...d })),
    };
  }
}
