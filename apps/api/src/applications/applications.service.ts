import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  COMMAND_TYPES,
  type ApplicationCatalogItemDto,
  type ApplicationDetailDto,
  type ApplicationDeviceInstallStatusDto,
  type AuthenticatedUser,
  type DeviceCommandDetailDto,
} from '@school-mdm/contracts';
import {
  createApplicationSchema,
  type CreateApplicationInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { CommandsService } from '../commands/commands.service';
import { DevicesService } from '../devices/devices.service';
import { MdmCapabilityService } from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { ClassScopeService } from '../rbac/class-scope.service';

@Injectable()
export class ApplicationsService {
  private readonly appsById = new Map<string, ApplicationCatalogItemDto>();
  private activeKioskAppId: string | null = null;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly commandsService: CommandsService,
    private readonly mdmProviderService: MdmProviderService,
    private readonly mdmCapabilityService: MdmCapabilityService,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {
    this.seedDefaultDeviceApps();
  }

  private seedDefaultDeviceApps() {
    const defaultApps = [
      {
        packageName: 'com.openai.chatgpt',
        name: 'ChatGPT (Trợ lý AI)',
        category: 'AI_ASSISTANT',
        versionName: '1.2024.312',
        versionCode: 31200,
        isApproved: true,
        description: 'Trợ lý AI hỗ trợ giải đáp bài tập, viết văn và nghiên cứu học tập',
      },
      {
        packageName: 'com.canva.editor',
        name: 'Canva (Thiết kế đồ họa)',
        category: 'DESIGN_EDUCATION',
        versionName: '2.285.0',
        versionCode: 28500,
        isApproved: true,
        description: 'Công cụ vẽ sơ đồ tư duy, làm slide thuyết trình và bài tập nhóm',
      },
      {
        packageName: 'com.android.chrome',
        name: 'Google Chrome',
        category: 'BROWSER',
        versionName: '128.0.6613.88',
        versionCode: 6613088,
        isApproved: true,
        description: 'Trình duyệt tra cứu tài liệu học tập và vào các trang web giáo dục',
      },
      {
        packageName: 'com.google.android.calculator',
        name: 'Máy tính học sinh (Calculator)',
        category: 'TOOLS',
        versionName: '8.6',
        versionCode: 86000,
        isApproved: true,
        description: 'Công cụ tính toán số học, lượng giác và giải toán khoa học',
      },
      {
        packageName: 'com.google.android.apps.nbu.files',
        name: 'Quản lý Học liệu (Files)',
        category: 'TOOLS',
        versionName: '1.4373',
        versionCode: 4373,
        isApproved: true,
        description: 'Mở bài tập PDF, tài liệu và video bài giảng do giáo viên gửi',
      },
      {
        packageName: 'com.android.camera2',
        name: 'Máy ảnh (Camera)',
        category: 'MEDIA',
        versionName: '2.0.002',
        versionCode: 2002,
        isApproved: false,
        description: 'Chụp ảnh tư liệu bài tập - Mặc định khóa trong giờ học lý thuyết',
      },
      {
        packageName: 'com.google.android.youtube',
        name: 'YouTube',
        category: 'MEDIA',
        versionName: '19.34.42',
        versionCode: 193442,
        isApproved: false,
        description: 'Ứng dụng video giải trí - Mặc định bị khóa để học sinh không xao nhãng',
      },
      {
        packageName: 'com.android.settings',
        name: 'Cài đặt hệ thống (Settings)',
        category: 'SYSTEM',
        versionName: '14.0',
        versionCode: 1400,
        isApproved: false,
        description: 'Cài đặt hệ điều hành Android - Luôn khóa đối với học sinh',
      },
    ];

    const now = new Date().toISOString();
    for (const app of defaultApps) {
      const id = randomUUID();
      this.appsById.set(id, {
        id,
        packageName: app.packageName,
        name: app.name,
        category: app.category,
        versionName: app.versionName,
        versionCode: app.versionCode,
        apkUrl: null,
        isApproved: app.isApproved,
        isMandatory: false,
        description: app.description,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  toggleAppApproval(appId: string): ApplicationCatalogItemDto {
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng trong danh mục');
    }
    app.isApproved = !app.isApproved;
    app.updatedAt = new Date().toISOString();
    return { ...app };
  }

  setActiveKioskApp(appId: string | null): { activeKioskApp: ApplicationCatalogItemDto | null } {
    if (!appId) {
      this.activeKioskAppId = null;
      return { activeKioskApp: null };
    }
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng để ghim');
    }
    this.activeKioskAppId = appId;
    return { activeKioskApp: { ...app } };
  }

  getActiveKioskApp(): ApplicationCatalogItemDto | null {
    if (!this.activeKioskAppId) return null;
    return this.appsById.get(this.activeKioskAppId) ?? null;
  }

  addCustomApp(input: {
    packageName: string;
    name: string;
    category?: string;
    description?: string;
  }): ApplicationCatalogItemDto {
    const trimmedPkg = (input.packageName || '').trim();
    if (!trimmedPkg) {
      throw new BadRequestException('Mã gói ứng dụng (Package Name) không được để trống');
    }

    for (const existing of this.appsById.values()) {
      if (existing.packageName.toLowerCase() === trimmedPkg.toLowerCase()) {
        return existing;
      }
    }

    const id = randomUUID();
    const nowIso = new Date().toISOString();
    const app: ApplicationCatalogItemDto = {
      id,
      packageName: trimmedPkg,
      name: (input.name || '').trim() || trimmedPkg,
      category: input.category || 'EDUCATION',
      versionName: '1.0.0',
      versionCode: 1,
      apkUrl: null,
      isApproved: true,
      isMandatory: false,
      description: input.description || 'Ứng dụng cài đặt trên máy tính bảng',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.appsById.set(id, app);
    return app;
  }

  async createApplication(
    actor: AuthenticatedUser,
    rawInput: CreateApplicationInput,
    requestId = randomUUID(),
  ): Promise<ApplicationCatalogItemDto> {
    this.classScope.assertAdminRole(actor, 'Thêm ứng dụng vào danh mục trường học');

    const parsed = createApplicationSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu ứng dụng không hợp lệ',
      );
    }

    for (const existing of this.appsById.values()) {
      if (existing.packageName === parsed.data.packageName) {
        throw new ConflictException(`Ứng dụng ${parsed.data.packageName} đã tồn tại trong danh mục`);
      }
    }

    const nowIso = new Date().toISOString();
    const created: ApplicationCatalogItemDto = {
      id: randomUUID(),
      packageName: parsed.data.packageName,
      name: parsed.data.name,
      category: parsed.data.category,
      versionName: parsed.data.versionName,
      versionCode: parsed.data.versionCode,
      apkUrl: parsed.data.apkUrl ?? null,
      isApproved: parsed.data.isApproved,
      isMandatory: parsed.data.isMandatory,
      description: parsed.data.description ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.appsById.set(created.id, created);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'APPLICATION_CREATED',
      targetType: 'APPLICATION',
      targetId: created.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        packageName: created.packageName,
        versionCode: created.versionCode,
        isApproved: created.isApproved,
      },
    });

    return { ...created };
  }

  async setApplicationApproval(
    actor: AuthenticatedUser,
    appId: string,
    isApproved: boolean,
    requestId = randomUUID(),
  ): Promise<ApplicationCatalogItemDto> {
    this.classScope.assertAdminRole(actor, 'Phê duyệt ứng dụng');

    const existing = this.appsById.get(appId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy ứng dụng trong danh mục');
    }

    existing.isApproved = isApproved;
    existing.updatedAt = new Date().toISOString();

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: isApproved ? 'APPLICATION_APPROVED' : 'APPLICATION_UNAPPROVED',
      targetType: 'APPLICATION',
      targetId: appId,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { packageName: existing.packageName, isApproved },
    });

    return { ...existing };
  }

  listApplications(): ApplicationCatalogItemDto[] {
    return Array.from(this.appsById.values()).map((a) => ({ ...a }));
  }

  async getApplicationDetail(
    actor: AuthenticatedUser,
    appId: string,
  ): Promise<ApplicationDetailDto> {
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng');
    }

    const visibleDevices = await this.devicesService.listDevices(actor, {
      page: 1,
      pageSize: 100,
    });

    const installedDevices: ApplicationDeviceInstallStatusDto[] = [];
    for (const devSummary of visibleDevices.items) {
      const detail = await this.devicesService.getDeviceDetail(actor, devSummary.id);
      const installedMatch = detail.installedApps.find(
        (inst) => inst.packageName === app.packageName,
      );
      if (installedMatch) {
        installedDevices.push({
          deviceId: detail.id,
          displayName: detail.displayName,
          installedVersionName: installedMatch.versionName,
          installedVersionCode: installedMatch.versionCode,
          isUpToDate: installedMatch.versionCode >= app.versionCode,
        });
      }
    }

    const adapter = this.mdmProviderService.getAdapter();
    const matrix = await this.mdmCapabilityService.inspectCapabilities(adapter);

    return {
      ...app,
      installedDevices,
      providerSupportsInstall: matrix.capabilities.installApplication.supported,
      providerSupportsRemove: matrix.capabilities.removeApplication.supported,
    };
  }

  async installOrUpdateAppOnDevice(
    actor: AuthenticatedUser,
    appId: string,
    deviceId: string,
    idempotencyKey: string,
  ): Promise<DeviceCommandDetailDto> {
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng');
    }

    if (!app.isApproved) {
      throw new BadRequestException(
        `Ứng dụng ${app.name} (${app.packageName}) chưa được phê duyệt để cài đặt lên thiết bị trường học.`,
      );
    }

    const deviceDetail = await this.devicesService.getDeviceDetail(actor, deviceId);
    const alreadyInstalled = deviceDetail.installedApps.some(
      (i) => i.packageName === app.packageName,
    );

    const commandType = alreadyInstalled ? COMMAND_TYPES.UPDATE_APP : COMMAND_TYPES.INSTALL_APP;

    return this.commandsService.dispatchCommand(actor, deviceId, {
      idempotencyKey,
      commandType,
      payload: {
        applicationId: app.id,
        packageName: app.packageName,
        versionName: app.versionName,
        versionCode: app.versionCode,
        apkUrl: app.apkUrl,
      },
      expiresInSeconds: 600,
    });
  }

  async removeAppFromDevice(
    actor: AuthenticatedUser,
    appId: string,
    deviceId: string,
    idempotencyKey: string,
  ): Promise<DeviceCommandDetailDto> {
    this.classScope.assertAdminRole(actor, 'Gỡ ứng dụng khỏi thiết bị');

    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng');
    }

    return this.commandsService.dispatchCommand(actor, deviceId, {
      idempotencyKey,
      commandType: COMMAND_TYPES.REMOVE_APP,
      payload: {
        applicationId: app.id,
        packageName: app.packageName,
      },
      expiresInSeconds: 600,
    });
  }
}
