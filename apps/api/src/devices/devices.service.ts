import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MDM_PROVIDER_TYPES,
  type AuthenticatedUser,
  type DeviceAssignmentRecordDto,
  type DeviceCommandSummaryDto,
  type DeviceDetailDto,
  type DeviceSummaryDto,
} from '@school-mdm/contracts';
import {
  agentCommandAckSchema,
  agentHeartbeatSchema,
  assignDeviceToClassSchema,
  deviceListFilterSchema,
  type AgentCommandAckInput,
  type AgentHeartbeatInput,
  type AssignDeviceToClassInput,
  type DeviceListFilterInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { ClassroomDpcAdapter } from '../mdm/adapters/classroom-dpc.adapter';
import { DeviceSyncService, type SyncedSchoolDeviceRecord } from '../mdm/device-sync.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { SchoolRepositoryPort } from '../school/school.repository';

@Injectable()
export class DevicesService {
  /**
   * Preserves complete assignment history per device; only 1 record per device can have isActive = true
   */
  private readonly assignmentsByDeviceId = new Map<string, DeviceAssignmentRecordDto[]>();

  /**
   * Command history per internal deviceId
   */
  private readonly commandHistoryByDeviceId = new Map<string, DeviceCommandSummaryDto[]>();

  /**
   * Real physical devices pre-registered by Android ID / Serial / IMEI
   */
  private readonly preRegisteredDevices = new Map<
    string,
    {
      id: string;
      androidId?: string;
      imei?: string;
      serialNumber?: string;
      name: string;
      classCode: string;
      status: 'PENDING_DETECTION' | 'ONLINE' | 'OFFLINE';
      batteryLevel?: number;
      model?: string;
      manufacturer?: string;
      lastSeenAt: Date | null;
      registeredAt: Date;
    }
  >();

  constructor(
    private readonly deviceSyncService: DeviceSyncService,
    private readonly classroomDpcAdapter: ClassroomDpcAdapter,
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  preRegisterDevice(input: {
    androidId?: string;
    imei?: string;
    serialNumber?: string;
    name: string;
    classCode?: string;
  }) {
    const rawIdentifier = (input.androidId || input.serialNumber || input.imei || '').trim();
    if (!rawIdentifier) {
      throw new BadRequestException(
        'Vui lòng nhập Mã định danh, Địa chỉ MAC Wi-Fi hoặc Số Serial của máy',
      );
    }

    const trimmedAndroidId = (input.androidId || '').trim();
    const trimmedSerial = (input.serialNumber || '').trim();
    const trimmedImei = (input.imei || '').trim();
    const primaryId = trimmedAndroidId || trimmedSerial || trimmedImei || rawIdentifier;
    const cleanPrimary = primaryId.toLowerCase().replace(/[:-]/g, '');

    // Check if device with this Android ID / Serial / MAC already exists
    for (const d of this.preRegisteredDevices.values()) {
      const dAndroid = (d.androidId || '').toLowerCase().replace(/[:-]/g, '');
      const dSerial = (d.serialNumber || '').toLowerCase().replace(/[:-]/g, '');
      const dImei = (d.imei || '').toLowerCase().replace(/[:-]/g, '');

      if (
        (dAndroid && dAndroid === cleanPrimary) ||
        (dSerial && dSerial === cleanPrimary) ||
        (dImei && dImei === cleanPrimary)
      ) {
        return d;
      }
    }

    const id = `reg-${randomUUID().slice(0, 8)}`;
    const record = {
      id,
      androidId: trimmedAndroidId || primaryId,
      imei: trimmedImei || undefined,
      serialNumber: trimmedSerial || primaryId,
      name: (input.name || '').trim() || `Máy Bàn ${this.preRegisteredDevices.size + 1}`,
      classCode: input.classCode || 'KHO',
      status: 'PENDING_DETECTION' as const,
      batteryLevel: undefined,
      model: undefined,
      manufacturer: undefined,
      lastSeenAt: null,
      registeredAt: new Date(),
    };

    this.preRegisteredDevices.set(id, record);
    return record;
  }

  deletePreRegisteredDevice(id: string) {
    this.preRegisteredDevices.delete(id);
    return { success: true };
  }

  batchAssignClass(deviceIds: string[], classCode: string) {
    if (!classCode) {
      throw new BadRequestException('Mã lớp học không được để trống');
    }
    const updated: string[] = [];
    for (const id of deviceIds) {
      const dev = this.preRegisteredDevices.get(id);
      if (dev) {
        dev.classCode = classCode;
        this.preRegisteredDevices.set(id, dev);
        updated.push(id);
      }
    }
    return { success: true, count: updated.length, deviceIds: updated };
  }

  getClassroomDevices(classCode?: string) {
    const now = new Date();
    let list = Array.from(this.preRegisteredDevices.values());
    if (classCode) {
      list = list.filter((d) => d.classCode === classCode);
    }

    return list.map((d) => {
      let computedStatus = d.status;
      if (d.lastSeenAt) {
        const elapsed = now.getTime() - d.lastSeenAt.getTime();
        // If device communicated within 60s, it's ONLINE; otherwise OFFLINE
        computedStatus = elapsed <= 60000 ? 'ONLINE' : 'OFFLINE';
      }
      return {
        id: d.id,
        androidId: d.androidId || d.serialNumber || d.imei,
        imei: d.imei,
        serialNumber: d.serialNumber,
        name: d.name,
        classCode: d.classCode,
        status: computedStatus,
        batteryLevel: d.batteryLevel ?? null,
        model: d.model ?? 'Đang nhận diện...',
        manufacturer: d.manufacturer ?? 'Android Tablet',
        lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
        lastSeen: d.lastSeenAt
          ? d.lastSeenAt.toLocaleTimeString('vi-VN')
          : 'Chờ thiết bị bật nguồn',
      };
    });
  }

  async processAgentHeartbeat(
    rawInput: AgentHeartbeatInput,
    heartbeatAt = new Date(),
  ): Promise<{ deviceId: string; status: string }> {
    const parsed = agentHeartbeatSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu heartbeat từ thiết bị không hợp lệ',
      );
    }

    // Match against real physical devices pre-registered by Android ID, Serial Number, IMEI, MAC or externalDeviceId
    const matchedExtId = (parsed.data.externalDeviceId || '').trim().toLowerCase();
    const matchedAndroidId = (parsed.data.androidId || '').trim().toLowerCase();
    const matchedSerial = (parsed.data.serialNumber || '').trim().toLowerCase();
    const matchedImei = (parsed.data.imei || '').trim().toLowerCase();

    const clean = (val?: string) => (val || '').toLowerCase().replace(/[:-]/g, '');
    const cleanExtId = clean(matchedExtId);
    const cleanAndroidId = clean(matchedAndroidId);
    const cleanSerial = clean(matchedSerial);
    const cleanImei = clean(matchedImei);

    let matchedAny = false;
    for (const [key, preReg] of this.preRegisteredDevices.entries()) {
      const regAndroidId = clean(preReg.androidId);
      const regSerial = clean(preReg.serialNumber);
      const regImei = clean(preReg.imei);

      const isMatch =
        (cleanExtId && (regAndroidId === cleanExtId || regSerial === cleanExtId || regImei === cleanExtId)) ||
        (cleanAndroidId && (regAndroidId === cleanAndroidId || regSerial === cleanAndroidId || regImei === cleanAndroidId)) ||
        (cleanSerial && (regSerial === cleanSerial || regAndroidId === cleanSerial || regImei === cleanSerial)) ||
        (cleanImei && (regImei === cleanImei || regAndroidId === cleanImei || regSerial === cleanImei));

      if (isMatch) {
        matchedAny = true;
        this.preRegisteredDevices.set(key, {
          ...preReg,
          status: 'ONLINE',
          batteryLevel: parsed.data.batteryLevel,
          model: parsed.data.model,
          manufacturer: parsed.data.manufacturer,
          lastSeenAt: heartbeatAt,
        });
      }
    }

    // Auto-discovery: If device is not pre-registered (e.g. user cannot find Serial Number),
    // automatically enroll it into KHO so it appears online in the portal immediately!
    if (!matchedAny) {
      const autoId = `reg-${randomUUID().slice(0, 8)}`;
      const cleanShortId = (parsed.data.serialNumber || parsed.data.androidId || parsed.data.externalDeviceId || 'P30').slice(-6).toUpperCase();
      const fallbackName = `Máy ${parsed.data.model || 'Teclast P30'} (${cleanShortId})`;

      this.preRegisteredDevices.set(autoId, {
        id: autoId,
        androidId: parsed.data.androidId || parsed.data.externalDeviceId,
        imei: parsed.data.imei,
        serialNumber: parsed.data.serialNumber || parsed.data.externalDeviceId,
        name: fallbackName,
        classCode: 'KHO',
        status: 'ONLINE',
        batteryLevel: parsed.data.batteryLevel,
        model: parsed.data.model,
        manufacturer: parsed.data.manufacturer,
        lastSeenAt: heartbeatAt,
        registeredAt: heartbeatAt,
      });
    }

    this.classroomDpcAdapter.registerDeviceHeartbeat({
      externalDeviceId: parsed.data.externalDeviceId,
      androidId: parsed.data.androidId,
      serialNumber: parsed.data.serialNumber,
      imei: parsed.data.imei,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model,
      androidVersion: parsed.data.androidVersion,
      sdkVersion: parsed.data.sdkVersion,
      batteryLevel: parsed.data.batteryLevel,
      lastSeenAt: heartbeatAt,
      installedApps: parsed.data.installedApps,
    });

    await this.deviceSyncService.syncDevices(
      'SCHEDULED',
      null,
      MDM_PROVIDER_TYPES.CLASSROOM_DPC,
    );

    const synced = this.deviceSyncService
      .listSyncedDevices(heartbeatAt)
      .find((d) => d.externalDeviceId === parsed.data.externalDeviceId);

    if (!synced) {
      throw new NotFoundException('Không thể đồng bộ thiết bị từ heartbeat');
    }

    return {
      deviceId: synced.id,
      status: synced.status,
    };
  }

  async processAgentCommandAck(
    externalCommandId: string,
    rawInput: AgentCommandAckInput,
  ): Promise<{ externalCommandId: string; status: string }> {
    const parsed = agentCommandAckSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu phản hồi lệnh không hợp lệ',
      );
    }

    this.classroomDpcAdapter.reportAgentCommandResult(
      externalCommandId,
      parsed.data.status,
      parsed.data.reason,
    );

    for (const historyList of this.commandHistoryByDeviceId.values()) {
      for (const cmd of historyList) {
        if (cmd.externalCommandId === externalCommandId) {
          cmd.status = parsed.data.status;
          cmd.failureReason =
            parsed.data.status === 'FAILED' ? (parsed.data.reason ?? null) : null;
          cmd.updatedAt = new Date().toISOString();
        }
      }
    }

    return {
      externalCommandId,
      status: parsed.data.status,
    };
  }

  async listDevices(
    actor: AuthenticatedUser,
    rawFilter?: Partial<DeviceListFilterInput>,
    now = new Date(),
  ): Promise<{
    items: DeviceSummaryDto[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }> {
    const parsed = deviceListFilterSchema.safeParse(rawFilter ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Bộ lọc không hợp lệ');
    }

    const filter = parsed.data;
    const isAdmin = this.classScope.isAdmin(actor);
    const teacherActiveClassIds = isAdmin
      ? []
      : await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);

    if (!isAdmin && filter.classId) {
      this.classScope.assertCanAccessClass(actor, filter.classId, teacherActiveClassIds);
    }

    let summaries = this.deviceSyncService
      .listSyncedDevices(now)
      .map((d) => this.toDeviceSummaryDto(d));

    // Enforce RBAC class scope for TEACHER: only see devices assigned to teacher's active classes
    if (!isAdmin) {
      const allowedSet = new Set(teacherActiveClassIds);
      summaries = summaries.filter(
        (d) => d.activeClassId !== null && allowedSet.has(d.activeClassId),
      );
    }

    if (filter.classId) {
      summaries = summaries.filter((d) => d.activeClassId === filter.classId);
    }

    if (filter.status) {
      summaries = summaries.filter((d) => d.status === filter.status);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      summaries = summaries.filter(
        (d) =>
          d.displayName.toLowerCase().includes(q) ||
          d.assetTag.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          (d.serialNumber?.toLowerCase().includes(q) ?? false),
      );
    }

    const totalItems = summaries.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / filter.pageSize));
    const offset = (filter.page - 1) * filter.pageSize;
    const items = summaries.slice(offset, offset + filter.pageSize);

    return {
      items,
      page: filter.page,
      pageSize: filter.pageSize,
      totalItems,
      totalPages,
    };
  }

  async getDeviceDetail(
    actor: AuthenticatedUser,
    deviceId: string,
    now = new Date(),
  ): Promise<DeviceDetailDto> {
    const synced = this.deviceSyncService.getSyncedDeviceById(deviceId, now);
    if (!synced) {
      throw new NotFoundException('Không tìm thấy thiết bị');
    }

    const summary = this.toDeviceSummaryDto(synced);
    if (!this.classScope.isAdmin(actor)) {
      const teacherClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
      if (!summary.activeClassId || !teacherClassIds.includes(summary.activeClassId)) {
        throw new ForbiddenException(
          'Giáo viên không được phép xem chi tiết thiết bị nằm ngoài phạm vi lớp được phân công.',
        );
      }
    }

    const assignmentHistory = (this.assignmentsByDeviceId.get(deviceId) ?? []).map((a) => ({
      ...a,
    }));
    const commandHistory = (this.commandHistoryByDeviceId.get(deviceId) ?? []).map((c) => ({
      ...c,
    }));

    return {
      ...summary,
      installedApps: [...synced.installedApps],
      assignmentHistory,
      commandHistory,
    };
  }

  async assignDeviceToClass(
    actor: AuthenticatedUser,
    deviceId: string,
    rawInput: AssignDeviceToClassInput,
    requestId = randomUUID(),
  ): Promise<DeviceAssignmentRecordDto> {
    this.classScope.assertAdminRole(actor, 'Gán thiết bị vào lớp học');

    const parsed = assignDeviceToClassSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu gán lớp không hợp lệ',
      );
    }

    const synced = this.deviceSyncService.getSyncedDeviceById(deviceId);
    if (!synced) {
      throw new NotFoundException('Không tìm thấy thiết bị cần gán lớp');
    }

    const targetClass = await this.schoolRepo.findClassById(parsed.data.classId);
    if (!targetClass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    const nowIso = new Date().toISOString();
    const history = this.assignmentsByDeviceId.get(deviceId) ?? [];

    // Close any currently active assignment so strictly ONE assignment is active at any time
    for (const existing of history) {
      if (existing.isActive) {
        existing.isActive = false;
        existing.unassignedAt = nowIso;
      }
    }

    const newAssignment: DeviceAssignmentRecordDto = {
      id: randomUUID(),
      deviceId,
      classId: parsed.data.classId,
      studentId: parsed.data.studentId ?? null,
      assignedById: actor.id,
      isActive: true,
      assignedAt: nowIso,
      unassignedAt: null,
      notes: parsed.data.notes ?? null,
    };

    history.unshift(newAssignment);
    this.assignmentsByDeviceId.set(deviceId, history);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'DEVICE_ASSIGNED_TO_CLASS',
      targetType: 'DEVICE',
      targetId: deviceId,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        classId: parsed.data.classId,
        studentId: parsed.data.studentId ?? null,
        assignmentId: newAssignment.id,
      },
    });

    return { ...newAssignment };
  }

  recordCommandInDeviceHistory(cmd: DeviceCommandSummaryDto): void {
    const list = this.commandHistoryByDeviceId.get(cmd.deviceId) ?? [];
    const existingIdx = list.findIndex((item) => item.id === cmd.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...cmd };
    } else {
      list.unshift({ ...cmd });
    }
    this.commandHistoryByDeviceId.set(cmd.deviceId, list);
  }

  private toDeviceSummaryDto(synced: SyncedSchoolDeviceRecord): DeviceSummaryDto {
    const history = this.assignmentsByDeviceId.get(synced.id) ?? [];
    const activeAssignment = history.find((a) => a.isActive) ?? null;

    return {
      id: synced.id,
      assetTag: synced.assetTag,
      serialNumber: synced.serialNumber,
      imei: synced.imei,
      displayName: synced.displayName,
      manufacturer: synced.manufacturer,
      model: synced.model,
      androidVersion: synced.androidVersion,
      sdkVersion: synced.sdkVersion,
      status: synced.status,
      batteryLevel: synced.batteryLevel,
      lastSeenAt: synced.lastSeenAt,
      activeClassId: activeAssignment?.classId ?? null,
      activeStudentId: activeAssignment?.studentId ?? null,
      providerType: synced.providerType,
      externalDeviceId: synced.externalDeviceId,
      updatedAt: synced.updatedAt,
    };
  }
}
