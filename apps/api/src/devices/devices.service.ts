import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
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
export class DevicesService implements OnModuleInit, OnModuleDestroy {
  /**
   * Preserves complete assignment history per device; only 1 record per device can have isActive = true
   */
  private readonly assignmentsByDeviceId = new Map<string, DeviceAssignmentRecordDto[]>();

  /**
   * Command history per internal deviceId
   */
  private readonly commandHistoryByDeviceId = new Map<string, DeviceCommandSummaryDto[]>();

  /**
   * Real physical devices pre-registered by Android ID / Serial / IMEI / IP / MAC
   */
  private readonly preRegisteredDevices = new Map<
    string,
    {
      id: string;
      androidId?: string;
      imei?: string;
      serialNumber?: string;
      ipAddress?: string;
      macAddress?: string;
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

  private pingInterval?: NodeJS.Timeout;

  constructor(
    private readonly deviceSyncService: DeviceSyncService,
    private readonly classroomDpcAdapter: ClassroomDpcAdapter,
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  onModuleInit() {
    this.pingInterval = setInterval(async () => {
      try {
        const { exec } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execAsync = promisify(exec);

        for (const [id, dev] of this.preRegisteredDevices.entries()) {
          if (dev.ipAddress) {
            try {
              const cmd =
                process.platform === 'win32'
                  ? `ping -n 1 -w 1000 ${dev.ipAddress}`
                  : `ping -c 1 -W 1 ${dev.ipAddress}`;
              const { stdout } = await execAsync(cmd);
              if (stdout.includes('TTL=') || stdout.includes('ttl=') || stdout.includes('bytes=')) {
                dev.lastSeenAt = new Date();
                dev.status = 'ONLINE';
                this.preRegisteredDevices.set(id, dev);
              }
            } catch {}
          }
        }
      } catch {}
    }, 15000);
  }

  onModuleDestroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  preRegisterDevice(input: {
    androidId?: string;
    imei?: string;
    serialNumber?: string;
    ipAddress?: string;
    macAddress?: string;
    name: string;
    classCode?: string;
    isOnline?: boolean;
    latencyMs?: number;
    model?: string;
    batteryLevel?: number;
  }) {
    const rawIdentifier = (
      input.ipAddress ||
      input.macAddress ||
      input.androidId ||
      input.serialNumber ||
      input.imei ||
      ''
    ).trim();

    if (!rawIdentifier) {
      throw new BadRequestException(
        'Vui lòng nhập Địa chỉ IP, MAC Wi-Fi hoặc Mã định danh của máy',
      );
    }

    const trimmedIp = (input.ipAddress || '').trim();
    const trimmedMac = (input.macAddress || '').trim();
    const trimmedAndroidId = (input.androidId || '').trim();
    const trimmedSerial = (input.serialNumber || '').trim();
    const trimmedImei = (input.imei || '').trim();
    const primaryId =
      trimmedIp || trimmedMac || trimmedAndroidId || trimmedSerial || trimmedImei || rawIdentifier;
    const cleanPrimary = primaryId.toLowerCase().replace(/[:-]/g, '');

    // Check if device with this IP / MAC / Android ID / Serial already exists
    for (const d of this.preRegisteredDevices.values()) {
      const dIp = (d.ipAddress || '').toLowerCase();
      const dMac = (d.macAddress || '').toLowerCase().replace(/[:-]/g, '');
      const dAndroid = (d.androidId || '').toLowerCase().replace(/[:-]/g, '');
      const dSerial = (d.serialNumber || '').toLowerCase().replace(/[:-]/g, '');

      if (
        (dIp && trimmedIp && dIp === trimmedIp) ||
        (dMac && dMac === cleanPrimary) ||
        (dAndroid && dAndroid === cleanPrimary) ||
        (dSerial && dSerial === cleanPrimary)
      ) {
        if (input.isOnline) {
          d.status = 'ONLINE';
          d.lastSeenAt = new Date();
          if (trimmedIp) d.ipAddress = trimmedIp;
          if (trimmedMac) d.macAddress = trimmedMac;
          if (input.model) d.model = input.model;
          if (input.batteryLevel !== undefined) d.batteryLevel = input.batteryLevel;
          if (input.name) d.name = input.name;
          if (input.classCode) d.classCode = input.classCode;
        }
        return d;
      }
    }

    const id = `reg-${randomUUID().slice(0, 8)}`;
    const isNowOnline = input.isOnline === true;
    const record = {
      id,
      androidId: trimmedAndroidId || primaryId,
      imei: trimmedImei || undefined,
      serialNumber: trimmedSerial || trimmedMac || primaryId,
      ipAddress: trimmedIp || (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(primaryId) ? primaryId : undefined),
      macAddress: trimmedMac || undefined,
      name: (input.name || '').trim() || `Máy Bàn ${this.preRegisteredDevices.size + 1}`,
      classCode: input.classCode || 'KHO',
      status: isNowOnline ? ('ONLINE' as const) : ('PENDING_DETECTION' as const),
      batteryLevel: isNowOnline ? (input.batteryLevel ?? 91) : undefined,
      model: isNowOnline ? (input.model || 'Teclast P30 (P30_ROW)') : undefined,
      manufacturer: isNowOnline ? 'Teclast' : undefined,
      lastSeenAt: isNowOnline ? new Date() : null,
      registeredAt: new Date(),
    };

    this.preRegisteredDevices.set(id, record);
    return record;
  }

  async probeDeviceConnection(target: string): Promise<{
    connected: boolean;
    ipAddress?: string;
    macAddress?: string;
    latencyMs?: number;
    model?: string;
    manufacturer?: string;
    message: string;
  }> {
    const cleanTarget = (target || '').trim();
    if (!cleanTarget) {
      throw new BadRequestException('Vui lòng nhập Địa chỉ IP hoặc MAC Wi-Fi của máy');
    }

    const isIp = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(cleanTarget);
    let targetIp = isIp ? cleanTarget : '';
    let targetMac = !isIp ? cleanTarget : '';

    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    // If MAC is provided, look up IP in ARP table
    if (!targetIp && targetMac) {
      try {
        const { stdout } = await execAsync('arp -a');
        const lines = stdout.split('\n');
        const normalizedTargetMac = targetMac.toLowerCase().replace(/[:-]/g, '-');
        for (const line of lines) {
          if (line.toLowerCase().includes(normalizedTargetMac)) {
            const ipMatch = line.trim().match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
            if (ipMatch) {
              targetIp = ipMatch[0];
              break;
            }
          }
        }
      } catch {}
    }

    if (!targetIp) {
      return {
        connected: false,
        message: `Chưa tìm thấy thiết bị với mã MAC "${cleanTarget}". Hãy thử nhập trực tiếp Địa chỉ IP của máy (ví dụ: 192.168.1.28).`,
      };
    }

    const startTime = Date.now();
    try {
      const pingCmd =
        process.platform === 'win32'
          ? `ping -n 1 -w 1500 ${targetIp}`
          : `ping -c 1 -W 2 ${targetIp}`;

      const { stdout } = await execAsync(pingCmd);
      const latencyMs = Date.now() - startTime;
      const isAlive =
        stdout.includes('TTL=') || stdout.includes('ttl=') || stdout.includes('bytes=');

      if (!isAlive) {
        return {
          connected: false,
          ipAddress: targetIp,
          message: `Không nhận được phản hồi từ IP ${targetIp}. Vui lòng kiểm tra máy tính bảng đã bật Wi-Fi và cùng mạng với máy chủ.`,
        };
      }

      if (!targetMac) {
        try {
          const { stdout: arpOut } = await execAsync(`arp -a ${targetIp}`);
          const macMatch = arpOut.match(/([0-9a-fA-F]{2}[:-]){5}([0-9a-fA-F]{2})/);
          if (macMatch) {
            targetMac = macMatch[0].replace(/-/g, ':').toUpperCase();
          }
        } catch {}
      }

      return {
        connected: true,
        ipAddress: targetIp,
        macAddress: targetMac || undefined,
        latencyMs,
        model: 'Teclast P30 (P30_ROW)',
        manufacturer: 'Teclast',
        message: `Kết nối thành công! Thiết bị phản hồi trong ${latencyMs}ms qua mạng LAN/Wi-Fi.`,
      };
    } catch {
      return {
        connected: false,
        ipAddress: targetIp,
        message: `Không thể kết nối đến ${targetIp}. Vui lòng kiểm tra mạng kết nối giữa 2 thiết bị.`,
      };
    }
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
        ipAddress: d.ipAddress,
        macAddress: d.macAddress,
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
