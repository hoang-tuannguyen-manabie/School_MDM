import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  MDM_PROVIDER_TYPES,
  ROLES,
  type AuthenticatedUser,
} from '@school-mdm/contracts';
import { ApplicationsService } from '../applications/applications.service';
import { InMemoryAuthRepository } from '../auth/auth.repository';
import { DevicesService } from '../devices/devices.service';
import { ClassroomDpcAdapter } from '../mdm/adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from '../mdm/adapters/headwind.adapter';
import { DeviceSyncService } from '../mdm/device-sync.service';
import { MdmCapabilityService } from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { PoliciesService } from '../policies/policies.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { InMemorySchoolRepository } from '../school/school.repository';
import { CommandsService } from './commands.service';

describe('Applications, Policy Engine & Command Engine (Phases 7, 8 & 9)', () => {
  let classroomAdapter: ClassroomDpcAdapter;
  let headwindAdapter: HeadwindAdapter;
  let capabilityService: MdmCapabilityService;
  let providerService: MdmProviderService;
  let syncService: DeviceSyncService;
  let schoolRepo: InMemorySchoolRepository;
  let authRepo: InMemoryAuthRepository;
  let classScope: ClassScopeService;
  let devicesService: DevicesService;
  let commandsService: CommandsService;
  let applicationsService: ApplicationsService;
  let policiesService: PoliciesService;
  let deviceId6A1: string;

  const adminActor: AuthenticatedUser = {
    id: randomUUID(),
    email: 'admin@school.local',
    fullName: 'Quản trị viên',
    roles: [ROLES.ADMIN],
    assignedClassIds: [],
  };

  const teacherLanActor: AuthenticatedUser = {
    id: randomUUID(),
    email: 'teacher.lan@school.local',
    fullName: 'Cô Nguyễn Thị Lan',
    roles: [ROLES.TEACHER],
    assignedClassIds: [],
  };

  beforeEach(async () => {
    classroomAdapter = new ClassroomDpcAdapter();
    headwindAdapter = new HeadwindAdapter();
    capabilityService = new MdmCapabilityService();
    providerService = new MdmProviderService(classroomAdapter, headwindAdapter);
    authRepo = new InMemoryAuthRepository();
    syncService = new DeviceSyncService(providerService, authRepo);
    schoolRepo = new InMemorySchoolRepository();
    classScope = new ClassScopeService();
    devicesService = new DevicesService(
      syncService,
      classroomAdapter,
      schoolRepo,
      classScope,
      authRepo,
    );
    commandsService = new CommandsService(
      devicesService,
      providerService,
      capabilityService,
      schoolRepo,
      classScope,
      authRepo,
    );
    applicationsService = new ApplicationsService(
      devicesService,
      commandsService,
      providerService,
      capabilityService,
      classScope,
      authRepo,
    );
    policiesService = new PoliciesService(
      providerService,
      capabilityService,
      classScope,
      authRepo,
    );

    const year = await schoolRepo.createAcademicYear({
      code: '2026-2027',
      name: 'Năm học 2026-2027',
      startDate: '2026-09-05',
      endDate: '2027-05-31',
      isCurrent: true,
    });

    const class6A1 = await schoolRepo.createClass({
      academicYearId: year.id,
      code: '6A1',
      name: 'Lớp 6A1',
      gradeLevel: 6,
    });

    await schoolRepo.assignTeacherToClass({
      teacherId: teacherLanActor.id,
      classId: class6A1.id,
      roleInClass: 'HOMEROOM',
    });

    const hb = await devicesService.processAgentHeartbeat({
      externalDeviceId: 'tab-6a1-01',
      serialNumber: 'SN-6A1-01',
      manufacturer: 'Samsung',
      model: 'SM-X200',
      androidVersion: '13',
      sdkVersion: 33,
      batteryLevel: 90,
      installedApps: [
        {
          packageName: 'vn.edu.school.math',
          name: 'Toán Lớp 6',
          versionName: '1.0.0',
          versionCode: 10,
        },
      ],
    });

    deviceId6A1 = hb.deviceId;
    await devicesService.assignDeviceToClass(adminActor, deviceId6A1, {
      classId: class6A1.id,
    });
  });

  it('enforces idempotency, capability validation (UNSUPPORTED on Headwind Community), and timeout sweeping in Command Engine', async () => {
    const idempotencyKey = randomUUID();

    // Teacher dispatches LOCK_DEVICE to device in assigned class 6A1
    const firstCmd = await commandsService.dispatchCommand(teacherLanActor, deviceId6A1, {
      idempotencyKey,
      commandType: COMMAND_TYPES.LOCK_DEVICE,
      payload: { reason: 'Chú ý lên bảng' },
      expiresInSeconds: 60,
    });

    expect(firstCmd.status).toBe(COMMAND_STATUSES.SENT);
    expect(firstCmd.attempts).toHaveLength(1);

    // Repeating with the same idempotencyKey returns the exact same command without a 2nd attempt
    const duplicateCmd = await commandsService.dispatchCommand(teacherLanActor, deviceId6A1, {
      idempotencyKey,
      commandType: COMMAND_TYPES.LOCK_DEVICE,
      payload: { reason: 'Chú ý lên bảng' },
      expiresInSeconds: 60,
    });

    expect(duplicateCmd.id).toBe(firstCmd.id);
    expect(duplicateCmd.attempts).toHaveLength(1);

    // Dispatching LOCK_DEVICE against HEADWIND_COMMUNITY returns UNSUPPORTED and 0 external dispatches
    const unsupportedCmd = await commandsService.dispatchCommand(
      teacherLanActor,
      deviceId6A1,
      {
        idempotencyKey: randomUUID(),
        commandType: COMMAND_TYPES.LOCK_DEVICE,
        payload: {},
        expiresInSeconds: 60,
      },
      { providerTypeOverride: MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY },
    );

    expect(unsupportedCmd.status).toBe(COMMAND_STATUSES.UNSUPPORTED);
    expect(unsupportedCmd.attempts).toHaveLength(0);

    // Sweeping after expiration marks SENT command as TIMEOUT
    const futureTime = new Date(Date.now() + 120_000);
    const sweptCount = commandsService.sweepExpiredCommands(futureTime);
    expect(sweptCount).toBe(1);

    const timedOutCmd = commandsService.getCommandById(firstCmd.id);
    expect(timedOutCmd.status).toBe(COMMAND_STATUSES.TIMEOUT);

    // Teacher attempting ADMIN-only REBOOT_DEVICE is blocked with 403 Forbidden
    await expect(
      commandsService.dispatchCommand(teacherLanActor, deviceId6A1, {
        idempotencyKey: randomUUID(),
        commandType: COMMAND_TYPES.REBOOT_DEVICE,
        payload: {},
        expiresInSeconds: 60,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('enforces Policy Version immutability after publishing and blocks publishing incompatible policies on Headwind Community', async () => {
    const policy = await policiesService.createPolicy(adminActor, {
      code: 'POL-EXAM-LOCK',
      name: 'Chế độ Kiểm tra Toán 6',
      initialRules: {
        kioskModeEnabled: true,
        kioskPackageName: 'vn.edu.school.math',
        appAllowlistEnabled: true,
        allowedPackages: ['vn.edu.school.math'],
        urlFilteringEnabled: false,
        allowedDomains: [],
        lockScreenDisabled: true,
      },
    });

    const v1 = policy.versions[0]!;
    expect(v1.status).toBe('DRAFT');

    // Attempt to publish on HEADWIND_COMMUNITY (which lacks kioskMode & appAllowlist) MUST fail
    await expect(
      policiesService.publishPolicyVersion(
        adminActor,
        policy.id,
        v1.id,
        MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY,
      ),
    ).rejects.toThrow(BadRequestException);

    // Publishing on CLASSROOM_DPC succeeds because ClassroomDpcAdapter supports kioskMode & appAllowlist
    const published = await policiesService.publishPolicyVersion(
      adminActor,
      policy.id,
      v1.id,
      MDM_PROVIDER_TYPES.CLASSROOM_DPC,
    );
    expect(published.currentVersionId).toBe(v1.id);
    expect(published.versions[0]?.status).toBe('PUBLISHED');

    // Attempting to edit v1 now that it is PUBLISHED must throw BadRequestException (immutable!)
    await expect(
      policiesService.updateDraftPolicyVersion(adminActor, policy.id, v1.id, {
        kioskModeEnabled: false,
        kioskPackageName: null,
        appAllowlistEnabled: false,
        allowedPackages: [],
        urlFilteringEnabled: false,
        allowedDomains: [],
        lockScreenDisabled: false,
      }),
    ).rejects.toThrow(BadRequestException);

    // Creating a new draft version v2 allows edits while keeping v1 immutable
    const v2 = await policiesService.createNewDraftVersion(adminActor, policy.id);
    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe('DRAFT');
  });

  it('tracks per-device app installation status and blocks installing unapproved apps', async () => {
    const mathApp = await applicationsService.createApplication(adminActor, {
      packageName: 'vn.edu.school.math',
      name: 'Toán Lớp 6',
      category: 'EDUCATION',
      versionName: '2.0.0',
      versionCode: 20,
      apkUrl: 'https://mdm.school.local/apks/math-v2.apk',
      isApproved: false,
      isMandatory: true,
    });

    // Device has versionCode 10 installed, catalog is versionCode 20 -> isUpToDate = false
    const detail = await applicationsService.getApplicationDetail(adminActor, mathApp.id);
    expect(detail.installedDevices).toHaveLength(1);
    expect(detail.installedDevices[0]?.installedVersionCode).toBe(10);
    expect(detail.installedDevices[0]?.isUpToDate).toBe(false);

    // Installing while unapproved must fail
    await expect(
      applicationsService.installOrUpdateAppOnDevice(
        teacherLanActor,
        mathApp.id,
        deviceId6A1,
        randomUUID(),
      ),
    ).rejects.toThrow(BadRequestException);

    // Approve app -> now Teacher can dispatch UPDATE_APP to device in class 6A1
    await applicationsService.setApplicationApproval(adminActor, mathApp.id, true);
    const updateCmd = await applicationsService.installOrUpdateAppOnDevice(
      teacherLanActor,
      mathApp.id,
      deviceId6A1,
      randomUUID(),
    );

    expect(updateCmd.commandType).toBe(COMMAND_TYPES.UPDATE_APP);
    expect(updateCmd.status).toBe(COMMAND_STATUSES.SENT);
  });
});
