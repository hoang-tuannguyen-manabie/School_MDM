import { Injectable } from '@nestjs/common';
import {
  COMMAND_STATUSES,
  MDM_PROVIDER_TYPES,
  mapCommandTypeToCapabilityKey,
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

@Injectable()
export class HeadwindAdapter implements MdmAdapter {
  private readonly baseUrl: string | undefined;
  private readonly apiKey: string | undefined;

  constructor() {
    this.baseUrl = process.env.HEADWIND_BASE_URL;
    this.apiKey = process.env.HEADWIND_API_KEY;
  }

  async connect(): Promise<{ connected: boolean; providerVersion: string; message?: string }> {
    if (!this.baseUrl || !this.apiKey || this.apiKey.startsWith('CHANGE_ME')) {
      return {
        connected: false,
        providerVersion: 'unverified',
        message:
          'Headwind MDM Community chưa được cấu hình HEADWIND_BASE_URL hoặc HEADWIND_API_KEY thực tế.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/rest/public/jwt/login`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return {
        connected: response.ok,
        providerVersion: response.headers.get('x-hmdm-version') ?? 'community-detected',
        message: response.ok
          ? 'Kết nối tới Headwind MDM thành công.'
          : `Headwind MDM phản hồi HTTP ${response.status}.`,
      };
    } catch (error) {
      return {
        connected: false,
        providerVersion: 'unreachable',
        message:
          error instanceof Error
            ? `Không thể kết nối tới Headwind MDM (${error.message}).`
            : 'Không thể kết nối tới Headwind MDM.',
      };
    }
  }

  async getDevices(_query?: MdmDeviceQuery): Promise<MdmExternalDevice[]> {
    // Do not fabricate devices when Headwind is not connected
    return [];
  }

  async getDevice(_externalDeviceId: string): Promise<MdmExternalDevice | null> {
    return null;
  }

  async getApplications(): Promise<MdmExternalApplication[]> {
    return [];
  }

  async getDeviceApplications(_externalDeviceId: string): Promise<MdmDeviceInstalledApp[]> {
    return [];
  }

  async sendCommand(command: MdmCommandEnvelope): Promise<MdmCommandDispatchResult> {
    const matrix = await this.getCapabilities();
    const capabilityKey = mapCommandTypeToCapabilityKey(command.commandType);
    const capability = matrix.capabilities[capabilityKey];

    if (!capability.supported) {
      return {
        externalCommandId: null,
        status: COMMAND_STATUSES.UNSUPPORTED,
        reason:
          capability.reason ??
          `Thao tác ${command.commandType} chưa được hỗ trợ bởi Headwind MDM Community.`,
        dispatchedAt: new Date().toISOString(),
      };
    }

    const connection = await this.connect();
    if (!connection.connected) {
      return {
        externalCommandId: null,
        status: COMMAND_STATUSES.FAILED,
        reason:
          connection.message ??
          'Không thể gửi lệnh vì máy chủ Headwind MDM chưa sẵn sàng kết nối.',
        dispatchedAt: new Date().toISOString(),
      };
    }

    return {
      externalCommandId: null,
      status: COMMAND_STATUSES.FAILED,
      reason: 'Cần xác minh contract API thực tế của phiên bản Headwind đang chạy ở Phase 5.',
      dispatchedAt: new Date().toISOString(),
    };
  }

  async getCommandStatus(externalCommandId: string): Promise<MdmCommandStatusResult> {
    return {
      externalCommandId,
      status: COMMAND_STATUSES.UNSUPPORTED,
      reason: 'Headwind Community chưa kết nối hoặc chưa xác minh endpoint trạng thái lệnh.',
      updatedAt: new Date().toISOString(),
    };
  }

  async getCapabilities(): Promise<MdmCapabilityMatrix> {
    return {
      providerType: MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY,
      providerVersion: 'community-baseline',
      verifiedAt: new Date().toISOString(),
      capabilities: {
        deviceInventory: {
          supported: true,
          reason: 'Hỗ trợ đồng bộ danh sách thiết bị đã enroll vào Headwind Community.',
        },
        appCatalog: {
          supported: true,
          reason: 'Hỗ trợ quản lý kho APK trên Headwind Community.',
        },
        installApplication: {
          supported: true,
          reason: 'Hỗ trợ cấu hình cài đặt APK qua configuration của Headwind Community.',
        },
        removeApplication: {
          supported: true,
          reason: 'Hỗ trợ gỡ ứng dụng qua cấu hình của Headwind Community.',
        },
        applyConfiguration: {
          supported: true,
          reason: 'Hỗ trợ áp dụng configuration profile cơ bản.',
        },
        kioskMode: {
          supported: false,
          reason:
            'Chưa được hỗ trợ bởi Headwind Community mặc định (Yêu cầu bản Enterprise hoặc chuyển sang chế độ CLASSROOM_DPC miễn phí).',
        },
        appAllowlist: {
          supported: false,
          reason:
            'Headwind Community không hỗ trợ khóa/ẩn ứng dụng theo Allowlist thời gian thực trong tiết học. Khuyến nghị dùng CLASSROOM_DPC.',
        },
        remoteLock: {
          supported: false,
          reason:
            'Headwind Community không hỗ trợ lệnh khóa màn hình tức thời (Remote Lock). Khuyến nghị dùng CLASSROOM_DPC.',
        },
        remoteReboot: {
          supported: false,
          reason: 'Headwind Community không hỗ trợ khởi động lại thiết bị từ xa mặc định.',
        },
        urlFiltering: {
          supported: false,
          reason: 'Headwind Community không tích hợp bộ lọc URL trình duyệt.',
        },
      },
    };
  }
}
