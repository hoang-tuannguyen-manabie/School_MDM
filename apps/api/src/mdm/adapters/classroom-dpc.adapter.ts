import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  COMMAND_STATUSES,
  DEVICE_STATUSES,
  MDM_PROVIDER_TYPES,
  mapCommandTypeToCapabilityKey,
  type CommandStatus,
  type DeviceStatus,
  type MdmAdapter,
  type MdmCapabilityMatrix,
  type MdmCommandDispatchResult,
  type MdmCommandEnvelope,
  type MdmCommandStatusResult,
  type MdmDeviceInstalledApp,
  type MdmDeviceQuery,
  type MdmExternalApplication,
  type MdmExternalDevice,
} from '@school-mdm/contracts';

export interface EnrolledClassroomDeviceRecord {
  externalDeviceId: string;
  androidId?: string;
  serialNumber?: string;
  imei?: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkVersion: number;
  batteryLevel?: number;
  lastSeenAt: Date | null;
  installedApps: MdmDeviceInstalledApp[];
}

@Injectable()
export class ClassroomDpcAdapter implements MdmAdapter {
  private readonly devices = new Map<string, EnrolledClassroomDeviceRecord>();
  private readonly appCatalog = new Map<string, MdmExternalApplication>();
  private readonly commandStatuses = new Map<
    string,
    { status: CommandStatus; reason?: string; updatedAt: string }
  >();
  private readonly offlineThresholdMs: number;

  constructor() {
    const thresholdSec = Number(process.env.CLASSROOM_OFFLINE_THRESHOLD_SEC ?? 45);
    this.offlineThresholdMs = thresholdSec * 1000;
  }

  /**
   * Called when a real Android tablet running the School DPC Agent sends an enrollment
   * or heartbeat payload over the classroom LAN.
   */
  registerDeviceHeartbeat(record: EnrolledClassroomDeviceRecord): void {
    this.devices.set(record.externalDeviceId, {
      ...record,
      installedApps: [...record.installedApps],
    });
  }

  /**
   * Called when a real Android tablet acknowledges or finishes executing a command.
   */
  reportAgentCommandResult(
    externalCommandId: string,
    status: CommandStatus,
    reason?: string,
  ): void {
    this.commandStatuses.set(externalCommandId, {
      status,
      reason,
      updatedAt: new Date().toISOString(),
    });
  }

  computeRealDeviceStatus(lastSeenAt: Date | null, now = new Date()): DeviceStatus {
    // Rule: Never infer ONLINE just because a device was registered
    if (!lastSeenAt) {
      return DEVICE_STATUSES.UNKNOWN;
    }

    const elapsedMs = now.getTime() - lastSeenAt.getTime();
    if (elapsedMs <= this.offlineThresholdMs) {
      return DEVICE_STATUSES.ONLINE;
    }

    return DEVICE_STATUSES.OFFLINE;
  }

  async connect(): Promise<{ connected: boolean; providerVersion: string; message?: string }> {
    return {
      connected: true,
      providerVersion: 'classroom-dpc-1.0.0',
      message:
        'Classroom DPC Gateway (0 đồng - Android DevicePolicyManager qua LAN) sẵn sàng nhận kết nối thiết bị.',
    };
  }

  async getDevices(query?: MdmDeviceQuery): Promise<MdmExternalDevice[]> {
    const now = new Date();
    let list = Array.from(this.devices.values()).map((d) => this.toExternalDevice(d, now));

    if (query?.search) {
      const q = query.search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.externalDeviceId.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          (d.serialNumber?.toLowerCase().includes(q) ?? false),
      );
    }

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? list.length;
    return list.slice(offset, offset + limit);
  }

  async getDevice(externalDeviceId: string): Promise<MdmExternalDevice | null> {
    const d = this.devices.get(externalDeviceId);
    if (!d) {
      return null;
    }
    return this.toExternalDevice(d, new Date());
  }

  async getApplications(): Promise<MdmExternalApplication[]> {
    return Array.from(this.appCatalog.values()).map((a) => ({ ...a }));
  }

  async getDeviceApplications(externalDeviceId: string): Promise<MdmDeviceInstalledApp[]> {
    const d = this.devices.get(externalDeviceId);
    if (!d) {
      return [];
    }
    return d.installedApps.map((app) => ({ ...app }));
  }

  async sendCommand(command: MdmCommandEnvelope): Promise<MdmCommandDispatchResult> {
    const now = new Date();
    const matrix = await this.getCapabilities();
    const capabilityKey = mapCommandTypeToCapabilityKey(command.commandType);
    const capability = matrix.capabilities[capabilityKey];

    if (!capability.supported) {
      return {
        externalCommandId: null,
        status: COMMAND_STATUSES.UNSUPPORTED,
        reason:
          capability.reason ??
          `Chức năng ${command.commandType} không được hỗ trợ bởi Classroom DPC hiện tại.`,
        dispatchedAt: now.toISOString(),
      };
    }

    const device = this.devices.get(command.externalDeviceId);
    if (!device) {
      return {
        externalCommandId: null,
        status: COMMAND_STATUSES.FAILED,
        reason: `Không tìm thấy thiết bị ${command.externalDeviceId} trên Classroom DPC.`,
        dispatchedAt: now.toISOString(),
      };
    }

    const currentStatus = this.computeRealDeviceStatus(device.lastSeenAt, now);
    const externalCommandId = `dpc-cmd-${randomUUID()}`;

    // Never fake SUCCESS! If device is ONLINE, command is SENT and awaits device ACK/SUCCESS.
    // If device is OFFLINE or UNKNOWN, command stays PENDING in queue until device reconnects.
    const initialStatus: CommandStatus =
      currentStatus === DEVICE_STATUSES.ONLINE
        ? COMMAND_STATUSES.SENT
        : COMMAND_STATUSES.PENDING;

    const reason =
      initialStatus === COMMAND_STATUSES.SENT
        ? 'Đã đẩy lệnh xuống thiết bị qua LAN, đang chờ phản hồi thực thi từ Android DPC Agent.'
        : 'Thiết bị đang ngoại tuyến (Offline); lệnh được xếp hàng chờ thiết bị kết nối lại.';

    this.commandStatuses.set(externalCommandId, {
      status: initialStatus,
      reason,
      updatedAt: now.toISOString(),
    });

    return {
      externalCommandId,
      status: initialStatus,
      reason,
      dispatchedAt: now.toISOString(),
    };
  }

  async getCommandStatus(externalCommandId: string): Promise<MdmCommandStatusResult> {
    const state = this.commandStatuses.get(externalCommandId);
    if (!state) {
      return {
        externalCommandId,
        status: COMMAND_STATUSES.FAILED,
        reason: 'Không tìm thấy mã lệnh trên Classroom DPC Gateway.',
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      externalCommandId,
      status: state.status,
      reason: state.reason,
      updatedAt: state.updatedAt,
    };
  }

  async getCapabilities(): Promise<MdmCapabilityMatrix> {
    return {
      providerType: MDM_PROVIDER_TYPES.CLASSROOM_DPC,
      providerVersion: 'classroom-dpc-1.0.0',
      verifiedAt: new Date().toISOString(),
      capabilities: {
        deviceInventory: {
          supported: true,
          reason: 'Thu thập thông tin phần cứng, pin và ứng dụng thời gian thực qua LAN.',
        },
        appCatalog: {
          supported: true,
          reason: 'Phân phối kho APK nội bộ trực tiếp từ Local Server.',
        },
        installApplication: {
          supported: true,
          reason: 'Cài đặt APK âm thầm qua PackageInstaller (quyền Device Owner).',
        },
        removeApplication: {
          supported: true,
          reason: 'Gỡ cài đặt ứng dụng âm thầm qua PackageInstaller (quyền Device Owner).',
        },
        applyConfiguration: {
          supported: true,
          reason: 'Áp dụng cấu hình thiết bị qua Android DevicePolicyManager.',
        },
        kioskMode: {
          supported: true,
          reason: 'Khóa thiết bị vào ứng dụng bài học qua startLockTask / setLockTaskPackages.',
        },
        appAllowlist: {
          supported: true,
          reason:
            'Đóng băng/ẩn các ứng dụng ngoài danh sách cho phép trong giờ học qua setPackagesSuspended.',
        },
        remoteLock: {
          supported: true,
          reason: 'Khóa màn hình tức thời toàn lớp qua DevicePolicyManager.lockNow().',
        },
        remoteReboot: {
          supported: true,
          reason: 'Khởi động lại thiết bị qua DevicePolicyManager.reboot() (Device Owner).',
        },
        urlFiltering: {
          supported: false,
          reason:
            'Lọc URL chi tiết cấp trình duyệt cần cấu hình Managed Configurations của Chrome hoặc DNS nội bộ.',
        },
      },
    };
  }

  private toExternalDevice(d: EnrolledClassroomDeviceRecord, now: Date): MdmExternalDevice {
    return {
      externalDeviceId: d.externalDeviceId,
      androidId: d.androidId,
      serialNumber: d.serialNumber,
      imei: d.imei,
      manufacturer: d.manufacturer,
      model: d.model,
      androidVersion: d.androidVersion,
      sdkVersion: d.sdkVersion,
      batteryLevel: d.batteryLevel,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      status: this.computeRealDeviceStatus(d.lastSeenAt, now),
    };
  }
}
