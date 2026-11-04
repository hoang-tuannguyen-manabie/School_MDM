import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  DEVICE_STATUSES,
  MDM_PROVIDER_TYPES,
  ROLES,
  type AuthenticatedUser,
} from '@school-mdm/contracts';
import { InMemoryAuthRepository } from '../auth/auth.repository';
import { ClassroomDpcAdapter } from './adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from './adapters/headwind.adapter';
import { DeviceSyncService } from './device-sync.service';
import { MdmCapabilityService } from './mdm-capability.service';
import { MdmProviderService } from './mdm-provider.service';

describe('MDM Provider Adapter & DeviceSyncService (Phase 4)', () => {
  let classroomAdapter: ClassroomDpcAdapter;
  let headwindAdapter: HeadwindAdapter;
  let capabilityService: MdmCapabilityService;
  let providerService: MdmProviderService;
  let syncService: DeviceSyncService;
  let authRepo: InMemoryAuthRepository;

  const adminActor: AuthenticatedUser = {
    id: randomUUID(),
    email: 'admin@school.local',
    fullName: 'Quản trị viên',
    roles: [ROLES.ADMIN],
    assignedClassIds: [],
  };

  beforeEach(() => {
    classroomAdapter = new ClassroomDpcAdapter();
    headwindAdapter = new HeadwindAdapter();
    capabilityService = new MdmCapabilityService();
    providerService = new MdmProviderService(classroomAdapter, headwindAdapter);
    authRepo = new InMemoryAuthRepository();
    syncService = new DeviceSyncService(providerService, authRepo);
  });

  it('honestly marks kioskMode, appAllowlist, and remoteLock as UNSUPPORTED on baseline Headwind Community', async () => {
    const compatibility = await capabilityService.checkPolicyCompatibility(headwindAdapter, [
      'kioskMode',
      'appAllowlist',
      'remoteLock',
    ]);

    expect(compatibility.compatible).toBe(false);
    expect(compatibility.unsupportedFeatures).toHaveLength(3);

    const dispatchResult = await headwindAdapter.sendCommand({
      idempotencyKey: randomUUID(),
      externalDeviceId: 'hmdm-device-01',
      commandType: COMMAND_TYPES.APPLY_KIOSK_POLICY,
      payload: { packageName: 'vn.edu.school.math' },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(dispatchResult.status).toBe(COMMAND_STATUSES.UNSUPPORTED);
    expect(dispatchResult.externalCommandId).toBeNull();
  });

  it('supports full classroom teaching controls on zero-cost ClassroomDpcAdapter and never fakes command SUCCESS before agent ACK', async () => {
    classroomAdapter.registerDeviceHeartbeat({
      externalDeviceId: 'tab-6a1-01',
      serialNumber: 'SN-SAMSUNG-001',
      manufacturer: 'Samsung',
      model: 'SM-X200 (Galaxy Tab A8)',
      androidVersion: '13',
      sdkVersion: 33,
      batteryLevel: 88,
      lastSeenAt: new Date(),
      installedApps: [
        {
          packageName: 'vn.edu.school.math',
          name: 'Toán Học Lớp 6',
          versionName: '1.2.0',
          versionCode: 12,
        },
      ],
    });

    const dispatch = await classroomAdapter.sendCommand({
      idempotencyKey: randomUUID(),
      externalDeviceId: 'tab-6a1-01',
      commandType: COMMAND_TYPES.LOCK_DEVICE,
      payload: {},
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    // Must be SENT, never faked as SUCCESS until tablet agent reports back
    expect(dispatch.status).toBe(COMMAND_STATUSES.SENT);
    expect(dispatch.externalCommandId).toBeTruthy();

    classroomAdapter.reportAgentCommandResult(
      dispatch.externalCommandId!,
      COMMAND_STATUSES.SUCCESS,
      'Đã khóa màn hình qua DevicePolicyManager.lockNow()',
    );

    const updatedStatus = await classroomAdapter.getCommandStatus(dispatch.externalCommandId!);
    expect(updatedStatus.status).toBe(COMMAND_STATUSES.SUCCESS);
  });

  it('prevents duplicate device records across repeated sync runs and computes truthful ONLINE/OFFLINE/UNKNOWN status', async () => {
    // Device 1: seen right now -> ONLINE
    classroomAdapter.registerDeviceHeartbeat({
      externalDeviceId: 'tab-6a1-01',
      serialNumber: 'SN-001',
      manufacturer: 'Samsung',
      model: 'SM-X200',
      androidVersion: '13',
      sdkVersion: 33,
      lastSeenAt: new Date(),
      installedApps: [],
    });

    // Device 2: last seen 10 minutes ago -> OFFLINE (not assumed online just because registered!)
    classroomAdapter.registerDeviceHeartbeat({
      externalDeviceId: 'tab-6a1-02',
      serialNumber: 'SN-002',
      manufacturer: 'Lenovo',
      model: 'TB-X306F',
      androidVersion: '11',
      sdkVersion: 30,
      lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
      installedApps: [],
    });

    // Device 3: enrolled but never sent heartbeat -> UNKNOWN
    classroomAdapter.registerDeviceHeartbeat({
      externalDeviceId: 'tab-6a1-03',
      serialNumber: 'SN-003',
      manufacturer: 'Samsung',
      model: 'SM-T500',
      androidVersion: '12',
      sdkVersion: 31,
      lastSeenAt: null,
      installedApps: [],
    });

    const firstRun = await syncService.syncDevices(
      'INITIAL',
      adminActor,
      MDM_PROVIDER_TYPES.CLASSROOM_DPC,
    );
    expect(firstRun.devicesFound).toBe(3);
    expect(firstRun.devicesCreated).toBe(3);
    expect(firstRun.devicesUpdated).toBe(0);

    // Second sync run with same 3 devices MUST update existing records, creating 0 duplicates
    const secondRun = await syncService.syncDevices(
      'SCHEDULED',
      adminActor,
      MDM_PROVIDER_TYPES.CLASSROOM_DPC,
    );
    expect(secondRun.devicesFound).toBe(3);
    expect(secondRun.devicesCreated).toBe(0);
    expect(secondRun.devicesUpdated).toBe(3);

    const syncedDevices = syncService.listSyncedDevices();
    expect(syncedDevices).toHaveLength(3);

    const dev1 = syncedDevices.find((d) => d.externalDeviceId === 'tab-6a1-01');
    const dev2 = syncedDevices.find((d) => d.externalDeviceId === 'tab-6a1-02');
    const dev3 = syncedDevices.find((d) => d.externalDeviceId === 'tab-6a1-03');

    expect(dev1?.status).toBe(DEVICE_STATUSES.ONLINE);
    expect(dev2?.status).toBe(DEVICE_STATUSES.OFFLINE);
    expect(dev3?.status).toBe(DEVICE_STATUSES.UNKNOWN);
  });
});
