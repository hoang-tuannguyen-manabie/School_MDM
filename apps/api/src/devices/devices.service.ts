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

  constructor(
    private readonly deviceSyncService: DeviceSyncService,
    private readonly classroomDpcAdapter: ClassroomDpcAdapter,
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

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

    this.classroomDpcAdapter.registerDeviceHeartbeat({
      externalDeviceId: parsed.data.externalDeviceId,
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
