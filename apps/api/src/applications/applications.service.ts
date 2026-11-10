import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
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
import { AdbControlService } from '../devices/adb-control.service';
import { DevicesService } from '../devices/devices.service';
import { MdmCapabilityService } from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { ClassScopeService } from '../rbac/class-scope.service';

export interface TabletAppMetadata {
  packageName: string;
  name: string;
  category: string;
  versionName: string;
  versionCode: number;
  isApproved: boolean;
  description: string;
}

/**
 * Exact 34 user-launchable applications installed on the school's Teclast P30 (P30_ROW)
 * queried via `cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER`
 */
export const TECLAST_P30_INSTALLED_APPS: TabletAppMetadata[] = [
  {
    packageName: 'com.openai.chatgpt',
    name: 'ChatGPT',
    category: 'AI_ASSISTANT',
    versionName: '1.2026.300',
    versionCode: 2630015,
    isApproved: true,
    description: 'Trợ lý AI hỗ trợ giải đáp bài tập, viết văn và nghiên cứu học tập',
  },
  {
    packageName: 'com.google.android.apps.bard',
    name: 'Google Gemini',
    category: 'AI_ASSISTANT',
    versionName: '1.0.995038376',
    versionCode: 345,
    isApproved: true,
    description: 'Trợ lý trí tuệ nhân tạo Google Gemini cài sẵn trên Teclast P30',
  },
  {
    packageName: 'com.canva.editor',
    name: 'Canva',
    category: 'DESIGN_EDUCATION',
    versionName: '2.385.0',
    versionCode: 29794486,
    isApproved: true,
    description: 'Thiết kế sơ đồ tư duy, slide thuyết trình và bài tập sáng tạo',
  },
  {
    packageName: 'com.google.android.apps.docs.editors.sheets',
    name: 'Google Trang tính (Sheets)',
    category: 'EDUCATION',
    versionName: '1.26.451.00.90',
    versionCode: 220714306,
    isApproved: true,
    description: 'Bảng tính thống kê số liệu, thực hành Tin học và Toán học',
  },
  {
    packageName: 'com.google.android.apps.docs',
    name: 'Google Drive',
    category: 'EDUCATION',
    versionName: '2.26.437.0',
    versionCode: 214712238,
    isApproved: true,
    description: 'Lưu trữ và nhận tài liệu, đề cương bài giảng từ giáo viên',
  },
  {
    packageName: 'com.google.android.keep',
    name: 'Ghi chú Keep (Google Keep)',
    category: 'EDUCATION',
    versionName: '5.26.441.00.90',
    versionCode: 220682588,
    isApproved: true,
    description: 'Sổ tay ghi chép nhanh bài giảng và danh sách việc cần làm trên lớp',
  },
  {
    packageName: 'com.google.android.apps.books',
    name: 'Google Play Sách (Play Books)',
    category: 'EDUCATION',
    versionName: '2026.10.16.0',
    versionCode: 395681,
    isApproved: true,
    description: 'Đọc sách giáo khoa điện tử, sách tham khảo EPUB và PDF',
  },
  {
    packageName: 'com.android.chrome',
    name: 'Google Chrome',
    category: 'BROWSER',
    versionName: '156.0.8078.81',
    versionCode: 807808104,
    isApproved: true,
    description: 'Trình duyệt tra cứu học liệu và làm bài kiểm tra trực tuyến',
  },
  {
    packageName: 'com.android.calculator2',
    name: 'Máy tính (Calculator)',
    category: 'TOOLS',
    versionName: '16.0',
    versionCode: 36,
    isApproved: true,
    description: 'Máy tính số học và lượng giác mặc định trên Teclast P30',
  },
  {
    packageName: 'com.google.android.apps.nbu.files',
    name: 'Files by Google (Tệp)',
    category: 'TOOLS',
    versionName: '1.13003.1002253400.1',
    versionCode: 2061783,
    isApproved: true,
    description: 'Quản lý tệp bài tập PDF, hình ảnh và học liệu lưu trên máy',
  },
  {
    packageName: 'com.google.android.calendar',
    name: 'Google Lịch (Calendar)',
    category: 'TOOLS',
    versionName: '2026.42.2',
    versionCode: 2018364884,
    isApproved: true,
    description: 'Xem thời khóa biểu, lịch kiểm tra và sự kiện lớp học',
  },
  {
    packageName: 'com.google.android.deskclock',
    name: 'Đồng hồ (Clock)',
    category: 'TOOLS',
    versionName: '9.1',
    versionCode: 76112330,
    isApproved: true,
    description: 'Đồng hồ bấm giờ làm bài tập nhóm và thí nghiệm khoa học',
  },
  {
    packageName: 'com.android.soundrecorder',
    name: 'Ghi âm (Sound Recorder)',
    category: 'TOOLS',
    versionName: '13.0',
    versionCode: 36,
    isApproved: true,
    description: 'Luyện phát âm Ngoại ngữ và thu âm bài thuyết trình',
  },
  {
    packageName: 'com.google.android.apps.maps',
    name: 'Bản đồ (Google Maps)',
    category: 'EDUCATION',
    versionName: '26.45.00',
    versionCode: 1068868465,
    isApproved: true,
    description: 'Bản đồ trực quan phục vụ môn Địa lý và Lịch sử',
  },
  {
    packageName: 'com.google.android.googlequicksearchbox',
    name: 'Google Search',
    category: 'BROWSER',
    versionName: '17.72.17',
    versionCode: 301831138,
    isApproved: true,
    description: 'Ứng dụng tìm kiếm thông tin nhanh của Google',
  },
  {
    packageName: 'com.google.android.apps.googleassistant',
    name: 'Trợ lý Google (Assistant)',
    category: 'AI_ASSISTANT',
    versionName: '0.1.884448652',
    versionCode: 78,
    isApproved: true,
    description: 'Trợ lý giọng nói hỗ trợ tra cứu nhanh bằng tiếng Việt và tiếng Anh',
  },
  {
    packageName: 'com.google.android.apps.photos',
    name: 'Google Photos (Ảnh)',
    category: 'MEDIA',
    versionName: '7.99.0',
    versionCode: 52617542,
    isApproved: true,
    description: 'Xem hình ảnh bài giảng và tư liệu học tập trên máy',
  },
  {
    packageName: 'com.google.android.apps.tachyon',
    name: 'Google Meet',
    category: 'COMMUNICATION',
    versionName: '383.0',
    versionCode: 7771901,
    isApproved: false,
    description: 'Gọi video trực tuyến - Mặc định khóa trong tiết học trực tiếp',
  },
  {
    packageName: 'com.google.android.gm',
    name: 'Gmail',
    category: 'COMMUNICATION',
    versionName: '2026.10.26',
    versionCode: 66141086,
    isApproved: false,
    description: 'Hộp thư điện tử - Khóa mặc định để tránh gửi tin nhắn riêng trong giờ',
  },
  {
    packageName: 'com.google.android.contacts',
    name: 'Danh bạ (Contacts)',
    category: 'COMMUNICATION',
    versionName: '4.91.20',
    versionCode: 3299667,
    isApproved: false,
    description: 'Quản lý danh bạ liên lạc trên thiết bị',
  },
  {
    packageName: 'com.android.camera2',
    name: 'Máy ảnh (Camera)',
    category: 'MEDIA',
    versionName: '16.0',
    versionCode: 36,
    isApproved: false,
    description: 'Chụp ảnh và quay video - Mặc định khóa trong giờ học lý thuyết',
  },
  {
    packageName: 'com.google.android.youtube',
    name: 'YouTube',
    category: 'MEDIA',
    versionName: '21.44.534',
    versionCode: 1561310246,
    isApproved: false,
    description: 'Xem video giải trí - Mặc định bị khóa để học sinh tập trung',
  },
  {
    packageName: 'com.google.android.apps.youtube.kids',
    name: 'YouTube Kids',
    category: 'MEDIA',
    versionName: '11.43.542',
    versionCode: 170698828,
    isApproved: false,
    description: 'Ứng dụng video thiếu nhi - Mặc định khóa trong giờ học',
  },
  {
    packageName: 'com.google.android.apps.youtube.music',
    name: 'YouTube Music',
    category: 'MEDIA',
    versionName: '9.44.52',
    versionCode: 94452240,
    isApproved: false,
    description: 'Ứng dụng nghe nhạc trực tuyến - Mặc định khóa trong tiết học',
  },
  {
    packageName: 'com.google.android.videos',
    name: 'Google TV',
    category: 'MEDIA',
    versionName: '4.39.5193',
    versionCode: 439860671,
    isApproved: false,
    description: 'Ứng dụng xem phim và truyền hình giải trí - Mặc định khóa',
  },
  {
    packageName: 'com.android.fmradio',
    name: 'Đài FM (FM Radio)',
    category: 'MEDIA',
    versionName: '2.0',
    versionCode: 3,
    isApproved: false,
    description: 'Nghe đài phát thanh FM trên máy tính bảng - Mặc định khóa',
  },
  {
    packageName: 'com.google.android.play.games',
    name: 'Play Trò chơi (Play Games)',
    category: 'GAMES_STORE',
    versionName: '2026.10.70836',
    versionCode: 708364440,
    isApproved: false,
    description: 'Trung tâm trò chơi điện tử Google Play - Luôn khóa trong giờ học',
  },
  {
    packageName: 'com.google.android.apps.kids.home',
    name: 'Google Kids Space',
    category: 'GAMES_STORE',
    versionName: '1.89.0',
    versionCode: 1330433,
    isApproved: false,
    description: 'Giao diện giải trí trẻ em - Khóa để sử dụng chế độ lớp học',
  },
  {
    packageName: 'com.android.vending',
    name: 'Cửa hàng Google Play (CH Play)',
    category: 'GAMES_STORE',
    versionName: '53.9.23',
    versionCode: 85392340,
    isApproved: false,
    description: 'Chợ tải ứng dụng & game - Khóa để ngăn học sinh tự ý cài đặt game',
  },
  {
    packageName: 'com.google.android.apps.adm',
    name: 'Tìm thiết bị (Find Device)',
    category: 'SYSTEM',
    versionName: '3.1.787-06',
    versionCode: 20015693,
    isApproved: false,
    description: 'Công cụ định vị thiết bị dành cho Quản trị viên',
  },
  {
    packageName: 'com.liuzh.deviceinfo',
    name: 'Device Info HW',
    category: 'SYSTEM',
    versionName: 'v3.2.3.0',
    versionCode: 348,
    isApproved: false,
    description: 'Công cụ kiểm tra thông số phần cứng máy tính bảng',
  },
  {
    packageName: 'com.teclast.custom',
    name: 'Trung tâm Teclast',
    category: 'SYSTEM',
    versionName: 'V1.1.9',
    versionCode: 118,
    isApproved: false,
    description: 'Ứng dụng tiện ích nhà sản xuất Teclast',
  },
  {
    packageName: 'com.teclast.teclastuserfeedback',
    name: 'Phản hồi Teclast',
    category: 'SYSTEM',
    versionName: 'V1.2.1',
    versionCode: 121,
    isApproved: false,
    description: 'Ứng dụng gửi phản hồi hệ thống Teclast',
  },
  {
    packageName: 'com.android.settings',
    name: 'Cài đặt hệ thống (Settings)',
    category: 'SYSTEM',
    versionName: '16.0',
    versionCode: 36,
    isApproved: false,
    description: 'Cài đặt hệ điều hành Android - Khóa không cho học sinh tự đổi cấu hình',
  },
];

@Injectable()
export class ApplicationsService implements OnModuleInit {
  private readonly appsById = new Map<string, ApplicationCatalogItemDto>();
  private readonly knownMetadataByPkg = new Map<string, TabletAppMetadata>();
  private activeKioskAppId: string | null = null;
  private lastTabletSyncAt: string | null = null;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly commandsService: CommandsService,
    private readonly mdmProviderService: MdmProviderService,
    private readonly mdmCapabilityService: MdmCapabilityService,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
    @Optional() private readonly adbControlService?: AdbControlService,
  ) {
    for (const meta of TECLAST_P30_INSTALLED_APPS) {
      this.knownMetadataByPkg.set(meta.packageName, meta);
    }
    this.seedDefaultDeviceApps();
  }

  onModuleInit() {
    // Automatically sync installed apps and enforce policies when API boots
    setTimeout(() => {
      void this.syncAppsFromConnectedTablet();
    }, 1500);
  }

  private seedDefaultDeviceApps() {
    const now = new Date().toISOString();
    for (const app of TECLAST_P30_INSTALLED_APPS) {
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

  /**
   * Queries the connected Teclast P30 via ADB and synchronizes the catalog
   * with the exact applications currently installed on the physical tablet.
   */
  async syncAppsFromConnectedTablet(): Promise<{
    syncedFromHardware: boolean;
    adbSerial: string | null;
    totalApps: number;
    lastSyncedAt: string;
    apps: ApplicationCatalogItemDto[];
  }> {
    const nowIso = new Date().toISOString();
    if (!this.adbControlService) {
      return {
        syncedFromHardware: false,
        adbSerial: null,
        totalApps: this.appsById.size,
        lastSyncedAt: this.lastTabletSyncAt ?? nowIso,
        apps: this.listApplications(),
      };
    }

    const liveResult = await this.adbControlService.getInstalledTabletPackages();
    if (!liveResult.connected || liveResult.packages.length === 0) {
      void this.adbControlService.syncAppCatalogPermissions(this.listApplications());
      return {
        syncedFromHardware: false,
        adbSerial: liveResult.serial,
        totalApps: this.appsById.size,
        lastSyncedAt: this.lastTabletSyncAt ?? nowIso,
        apps: this.listApplications(),
      };
    }

    // Build lookup of existing catalog entries by packageName to preserve IDs and Admin approval toggles
    const existingByPkg = new Map<string, ApplicationCatalogItemDto>();
    for (const item of this.appsById.values()) {
      existingByPkg.set(item.packageName, item);
    }

    const livePkgSet = new Set<string>();
    for (const livePkg of liveResult.packages) {
      livePkgSet.add(livePkg.packageName);
      const existing = existingByPkg.get(livePkg.packageName);
      if (existing) {
        existing.versionCode = livePkg.versionCode || existing.versionCode;
        existing.updatedAt = nowIso;
      } else {
        const known = this.knownMetadataByPkg.get(livePkg.packageName);
        const id = randomUUID();
        this.appsById.set(id, {
          id,
          packageName: livePkg.packageName,
          name: known?.name ?? this.formatFallbackAppName(livePkg.packageName),
          category: known?.category ?? 'EDUCATION',
          versionName: known?.versionName ?? '1.0',
          versionCode: livePkg.versionCode || known?.versionCode || 1,
          apkUrl: null,
          isApproved: known?.isApproved ?? false,
          isMandatory: false,
          description:
            known?.description ?? 'Ứng dụng được phát hiện trực tiếp từ máy tính bảng Teclast P30',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    // Remove any seeded package that is no longer installed on the physical tablet
    for (const [id, item] of Array.from(this.appsById.entries())) {
      if (!livePkgSet.has(item.packageName)) {
        this.appsById.delete(id);
      }
    }

    this.lastTabletSyncAt = nowIso;
    const updatedList = this.listApplications();
    await this.adbControlService.syncAppCatalogPermissions(updatedList);

    return {
      syncedFromHardware: true,
      adbSerial: liveResult.serial,
      totalApps: updatedList.length,
      lastSyncedAt: nowIso,
      apps: updatedList,
    };
  }

  private formatFallbackAppName(packageName: string): string {
    const parts = packageName.split('.');
    const last = parts[parts.length - 1] || packageName;
    return last.charAt(0).toUpperCase() + last.slice(1);
  }

  toggleAppApproval(appId: string): ApplicationCatalogItemDto {
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng trong danh mục');
    }
    app.isApproved = !app.isApproved;
    app.updatedAt = new Date().toISOString();
    void this.adbControlService?.syncAppCatalogPermissions(this.listApplications());
    return { ...app };
  }

  setActiveKioskApp(appId: string | null): { activeKioskApp: ApplicationCatalogItemDto | null } {
    if (!appId) {
      this.activeKioskAppId = null;
      void this.adbControlService?.setKioskApp(null);
      return { activeKioskApp: null };
    }
    const app = this.appsById.get(appId);
    if (!app) {
      throw new NotFoundException('Không tìm thấy ứng dụng để ghim');
    }
    this.activeKioskAppId = appId;
    void this.adbControlService?.setKioskApp(app.packageName);
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
    void this.adbControlService?.syncAppCatalogPermissions(this.listApplications());
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
    void this.adbControlService?.syncAppCatalogPermissions(this.listApplications());

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
