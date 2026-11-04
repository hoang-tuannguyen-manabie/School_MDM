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
  type AuthenticatedUser,
  type CommandAttemptDto,
  type CommandType,
  type DeviceCommandDetailDto,
  type MdmProviderType,
} from '@school-mdm/contracts';
import {
  dispatchDeviceCommandSchema,
  type DispatchDeviceCommandInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { DevicesService } from '../devices/devices.service';
import { MdmCapabilityService } from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { SchoolRepositoryPort } from '../school/school.repository';

const TEACHER_ALLOWED_COMMAND_TYPES = new Set<CommandType>([
  COMMAND_TYPES.SYNC_DEVICE,
  COMMAND_TYPES.LOCK_DEVICE,
  COMMAND_TYPES.APPLY_KIOSK_POLICY,
  COMMAND_TYPES.APPLY_ALLOWLIST,
  COMMAND_TYPES.APPLY_CONFIGURATION,
  COMMAND_TYPES.INSTALL_APP,
  COMMAND_TYPES.UPDATE_APP,
]);

@Injectable()
export class CommandsService {
  private readonly commandsById = new Map<string, DeviceCommandDetailDto>();
  private readonly commandIdByIdempotencyKey = new Map<string, string>();

  constructor(
    private readonly devicesService: DevicesService,
    private readonly mdmProviderService: MdmProviderService,
    private readonly mdmCapabilityService: MdmCapabilityService,
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  async dispatchCommand(
    actor: AuthenticatedUser,
    deviceId: string,
    rawInput: DispatchDeviceCommandInput,
    options?: {
      sessionId?: string;
      providerTypeOverride?: MdmProviderType;
      requestId?: string;
    },
  ): Promise<DeviceCommandDetailDto> {
    const parsed = dispatchDeviceCommandSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu lệnh gửi thiết bị không hợp lệ',
      );
    }

    const input = parsed.data;
    const requestId = options?.requestId ?? randomUUID();

    // Idempotency guarantee: if idempotencyKey already exists, return existing command without re-sending
    const existingCommandId = this.commandIdByIdempotencyKey.get(input.idempotencyKey);
    if (existingCommandId) {
      const existing = this.commandsById.get(existingCommandId);
      if (existing) {
        return this.cloneCommand(existing);
      }
    }

    // Verify device existence and RBAC class scope for TEACHER
    const deviceDetail = await this.devicesService.getDeviceDetail(actor, deviceId);

    if (!this.classScope.isAdmin(actor)) {
      if (!TEACHER_ALLOWED_COMMAND_TYPES.has(input.commandType)) {
        throw new ForbiddenException(
          `Giáo viên không được cấp quyền thực hiện lệnh ${input.commandType}`,
        );
      }

      const teacherClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
      if (!deviceDetail.activeClassId || !teacherClassIds.includes(deviceDetail.activeClassId)) {
        throw new ForbiddenException(
          'Giáo viên chỉ được gửi lệnh tới thiết bị thuộc lớp mình đang phụ trách',
        );
      }
    }

    const providerType = options?.providerTypeOverride ?? deviceDetail.providerType;
    const adapter = this.mdmProviderService.getAdapter(providerType);
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAtIso = new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString();
    const commandId = randomUUID();

    // Check provider capability BEFORE dispatching
    const capabilityCheck = await this.mdmCapabilityService.checkCommandSupport(
      adapter,
      input.commandType,
    );

    if (!capabilityCheck.supported) {
      const unsupportedCommand: DeviceCommandDetailDto = {
        id: commandId,
        idempotencyKey: input.idempotencyKey,
        deviceId,
        providerType,
        sessionId: options?.sessionId ?? null,
        actorUserId: actor.id,
        commandType: input.commandType,
        payload: { ...input.payload },
        status: COMMAND_STATUSES.UNSUPPORTED,
        externalCommandId: null,
        maxRetries: 3,
        retryCount: 0,
        failureReason: capabilityCheck.reason ?? 'Provider hiện tại không hỗ trợ thao tác này',
        expiresAt: expiresAtIso,
        sentAt: null,
        acknowledgedAt: null,
        completedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        attempts: [],
      };

      this.saveCommandRecord(unsupportedCommand);

      await this.authRepo.recordAuditLog({
        actorUserId: actor.id,
        actorRole: actor.roles[0] ?? null,
        action: 'DEVICE_COMMAND_REJECTED_UNSUPPORTED',
        targetType: 'DEVICE_COMMAND',
        targetId: commandId,
        result: 'FAILURE',
        requestId,
        ipAddress: null,
        userAgent: null,
        metadata: {
          deviceId,
          commandType: input.commandType,
          providerType,
          reason: unsupportedCommand.failureReason,
        },
      });

      return this.cloneCommand(unsupportedCommand);
    }

    // Provider supports capability -> dispatch via adapter
    const dispatchResult = await adapter.sendCommand({
      idempotencyKey: input.idempotencyKey,
      externalDeviceId: deviceDetail.externalDeviceId,
      commandType: input.commandType,
      payload: input.payload,
      expiresAt: expiresAtIso,
    });

    const firstAttempt: CommandAttemptDto = {
      id: randomUUID(),
      commandId,
      attemptNumber: 1,
      status: dispatchResult.status,
      externalCommandId: dispatchResult.externalCommandId,
      errorMessage:
        dispatchResult.status === COMMAND_STATUSES.FAILED ||
        dispatchResult.status === COMMAND_STATUSES.UNSUPPORTED
          ? (dispatchResult.reason ?? null)
          : null,
      startedAt: nowIso,
      finishedAt: dispatchResult.dispatchedAt,
    };

    const commandRecord: DeviceCommandDetailDto = {
      id: commandId,
      idempotencyKey: input.idempotencyKey,
      deviceId,
      providerType,
      sessionId: options?.sessionId ?? null,
      actorUserId: actor.id,
      commandType: input.commandType,
      payload: { ...input.payload },
      status: dispatchResult.status,
      externalCommandId: dispatchResult.externalCommandId,
      maxRetries: 3,
      retryCount: 0,
      failureReason: firstAttempt.errorMessage,
      expiresAt: expiresAtIso,
      sentAt: dispatchResult.status === COMMAND_STATUSES.SENT ? dispatchResult.dispatchedAt : null,
      acknowledgedAt: null,
      completedAt:
        dispatchResult.status === COMMAND_STATUSES.SUCCESS ||
        dispatchResult.status === COMMAND_STATUSES.FAILED ||
        dispatchResult.status === COMMAND_STATUSES.UNSUPPORTED
          ? dispatchResult.dispatchedAt
          : null,
      createdAt: nowIso,
      updatedAt: dispatchResult.dispatchedAt,
      attempts: [firstAttempt],
    };

    this.saveCommandRecord(commandRecord);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? null,
      action: 'DEVICE_COMMAND_DISPATCHED',
      targetType: 'DEVICE_COMMAND',
      targetId: commandId,
      result: dispatchResult.status === COMMAND_STATUSES.FAILED ? 'FAILURE' : 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        deviceId,
        commandType: input.commandType,
        status: dispatchResult.status,
        externalCommandId: dispatchResult.externalCommandId,
      },
    });

    return this.cloneCommand(commandRecord);
  }

  async retryCommand(
    actor: AuthenticatedUser,
    commandId: string,
    now = new Date(),
  ): Promise<DeviceCommandDetailDto> {
    const cmd = this.commandsById.get(commandId);
    if (!cmd) {
      throw new NotFoundException('Không tìm thấy lệnh cần thử lại');
    }

    if (cmd.status === COMMAND_STATUSES.UNSUPPORTED) {
      throw new BadRequestException('Không thể retry lệnh không được provider hỗ trợ (UNSUPPORTED)');
    }

    if (cmd.status === COMMAND_STATUSES.SUCCESS) {
      throw new BadRequestException('Lệnh đã thực thi thành công, không cần retry');
    }

    if (new Date(cmd.expiresAt) <= now) {
      cmd.status = COMMAND_STATUSES.TIMEOUT;
      cmd.failureReason = 'Lệnh đã quá thời gian hiệu lực (expiresAt)';
      cmd.updatedAt = now.toISOString();
      this.saveCommandRecord(cmd);
      throw new BadRequestException('Lệnh đã hết hạn (Expired), không thể retry');
    }

    if (cmd.retryCount >= cmd.maxRetries) {
      throw new BadRequestException(`Đã vượt quá số lần thử lại tối đa (${cmd.maxRetries})`);
    }

    const deviceDetail = await this.devicesService.getDeviceDetail(actor, cmd.deviceId, now);
    const adapter = this.mdmProviderService.getAdapter(cmd.providerType);

    cmd.retryCount += 1;
    const attemptNumber = cmd.attempts.length + 1;
    const startedAtIso = now.toISOString();

    const dispatchResult = await adapter.sendCommand({
      idempotencyKey: `${cmd.idempotencyKey}:retry:${cmd.retryCount}`,
      externalDeviceId: deviceDetail.externalDeviceId,
      commandType: cmd.commandType,
      payload: cmd.payload,
      expiresAt: cmd.expiresAt,
    });

    const attempt: CommandAttemptDto = {
      id: randomUUID(),
      commandId: cmd.id,
      attemptNumber,
      status: dispatchResult.status,
      externalCommandId: dispatchResult.externalCommandId,
      errorMessage:
        dispatchResult.status === COMMAND_STATUSES.FAILED ? (dispatchResult.reason ?? null) : null,
      startedAt: startedAtIso,
      finishedAt: dispatchResult.dispatchedAt,
    };

    cmd.attempts.push(attempt);
    cmd.status = dispatchResult.status;
    cmd.externalCommandId = dispatchResult.externalCommandId ?? cmd.externalCommandId;
    cmd.failureReason = attempt.errorMessage;
    cmd.updatedAt = dispatchResult.dispatchedAt;
    if (dispatchResult.status === COMMAND_STATUSES.SENT && !cmd.sentAt) {
      cmd.sentAt = dispatchResult.dispatchedAt;
    }

    this.saveCommandRecord(cmd);
    return this.cloneCommand(cmd);
  }

  async syncCommandStatusFromProvider(commandId: string): Promise<DeviceCommandDetailDto> {
    const cmd = this.commandsById.get(commandId);
    if (!cmd) {
      throw new NotFoundException('Không tìm thấy lệnh');
    }

    if (!cmd.externalCommandId) {
      return this.cloneCommand(cmd);
    }

    const adapter = this.mdmProviderService.getAdapter(cmd.providerType);
    const externalState = await adapter.getCommandStatus(cmd.externalCommandId);

    cmd.status = externalState.status;
    cmd.updatedAt = externalState.updatedAt;
    if (externalState.status === COMMAND_STATUSES.ACKNOWLEDGED && !cmd.acknowledgedAt) {
      cmd.acknowledgedAt = externalState.updatedAt;
    }
    if (
      externalState.status === COMMAND_STATUSES.SUCCESS ||
      externalState.status === COMMAND_STATUSES.FAILED ||
      externalState.status === COMMAND_STATUSES.TIMEOUT
    ) {
      cmd.completedAt = externalState.updatedAt;
      if (externalState.status !== COMMAND_STATUSES.SUCCESS) {
        cmd.failureReason = externalState.reason ?? cmd.failureReason;
      }
    }

    this.saveCommandRecord(cmd);
    return this.cloneCommand(cmd);
  }

  sweepExpiredCommands(now = new Date()): number {
    let timedOutCount = 0;
    const nowIso = now.toISOString();

    for (const cmd of this.commandsById.values()) {
      if (
        (cmd.status === COMMAND_STATUSES.PENDING ||
          cmd.status === COMMAND_STATUSES.SENT ||
          cmd.status === COMMAND_STATUSES.ACKNOWLEDGED) &&
        new Date(cmd.expiresAt) <= now
      ) {
        cmd.status = COMMAND_STATUSES.TIMEOUT;
        cmd.failureReason = 'Quá thời hạn phản hồi từ thiết bị (Command Timeout)';
        cmd.completedAt = nowIso;
        cmd.updatedAt = nowIso;
        this.saveCommandRecord(cmd);
        timedOutCount++;
      }
    }

    return timedOutCount;
  }

  listCommandsForDevice(deviceId: string): DeviceCommandDetailDto[] {
    const list: DeviceCommandDetailDto[] = [];
    for (const cmd of this.commandsById.values()) {
      if (cmd.deviceId === deviceId) {
        list.push(this.cloneCommand(cmd));
      }
    }
    return list;
  }

  listAllCommands(): DeviceCommandDetailDto[] {
    return Array.from(this.commandsById.values()).map((cmd) => this.cloneCommand(cmd));
  }

  getCommandById(commandId: string): DeviceCommandDetailDto {
    const cmd = this.commandsById.get(commandId);
    if (!cmd) {
      throw new NotFoundException('Không tìm thấy lệnh');
    }
    return this.cloneCommand(cmd);
  }

  private saveCommandRecord(cmd: DeviceCommandDetailDto): void {
    this.commandsById.set(cmd.id, cmd);
    this.commandIdByIdempotencyKey.set(cmd.idempotencyKey, cmd.id);
    this.devicesService.recordCommandInDeviceHistory({
      id: cmd.id,
      idempotencyKey: cmd.idempotencyKey,
      deviceId: cmd.deviceId,
      commandType: cmd.commandType,
      status: cmd.status,
      externalCommandId: cmd.externalCommandId,
      failureReason: cmd.failureReason,
      actorUserId: cmd.actorUserId,
      createdAt: cmd.createdAt,
      updatedAt: cmd.updatedAt,
    });
  }

  private cloneCommand(cmd: DeviceCommandDetailDto): DeviceCommandDetailDto {
    return {
      ...cmd,
      payload: { ...cmd.payload },
      attempts: cmd.attempts.map((a) => ({ ...a })),
    };
  }
}
