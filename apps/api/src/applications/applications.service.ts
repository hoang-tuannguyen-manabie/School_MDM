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

  constructor(
    private readonly devicesService: DevicesService,
    private readonly commandsService: CommandsService,
    private readonly mdmProviderService: MdmProviderService,
    private readonly mdmCapabilityService: MdmCapabilityService,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

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
