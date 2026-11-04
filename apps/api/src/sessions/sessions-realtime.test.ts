import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  COMMAND_STATUSES,
  MDM_PROVIDER_TYPES,
  REALTIME_EVENTS,
  ROLES,
  type AuthenticatedUser,
} from '@school-mdm/contracts';
import { InMemoryAuthRepository } from '../auth/auth.repository';
import { CommandsService } from '../commands/commands.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { DevicesService } from '../devices/devices.service';
import { ClassroomDpcAdapter } from '../mdm/adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from '../mdm/adapters/headwind.adapter';
import { DeviceSyncService } from '../mdm/device-sync.service';
import { MdmCapabilityService } from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { PoliciesService } from '../policies/policies.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InMemorySchoolRepository } from '../school/school.repository';
import { SessionsService } from './sessions.service';

describe('Phase 10 & Phase 11 – Class Sessions, Offline Reconnect Reconciliation, Realtime RBAC & Dashboard', () => {
  async function setupStack() {
    const authRepo = new InMemoryAuthRepository();
    const schoolRepo = new InMemorySchoolRepository();
    const classScope = new ClassScopeService();

    const headwindAdapter = new HeadwindAdapter();
    const classroomDpcAdapter = new ClassroomDpcAdapter();
    const mdmCapabilityService = new MdmCapabilityService();
    const mdmProviderService = new MdmProviderService(classroomDpcAdapter, headwindAdapter);
    const deviceSyncService = new DeviceSyncService(mdmProviderService, authRepo);

    const devicesService = new DevicesService(
      deviceSyncService,
      classroomDpcAdapter,
      schoolRepo,
      classScope,
      authRepo,
    );

    const commandsService = new CommandsService(
      devicesService,
      mdmProviderService,
      mdmCapabilityService,
      schoolRepo,
      classScope,
      authRepo,
    );

    const policiesService = new PoliciesService(
      mdmProviderService,
      mdmCapabilityService,
      classScope,
      authRepo,
    );

    const realtimeGateway = new RealtimeGateway(classScope, schoolRepo);

    const sessionsService = new SessionsService(
      schoolRepo,
      classScope,
      devicesService,
      policiesService,
      commandsService,
      realtimeGateway,
      authRepo,
    );

    const dashboardService = new DashboardService(
      schoolRepo,
      classScope,
      devicesService,
      deviceSyncService,
      commandsService,
      sessionsService,
      realtimeGateway,
      authRepo,
    );

    const adminActor: AuthenticatedUser = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@school.edu.vn',
      fullName: 'Quản trị viên',
      roles: [ROLES.ADMIN],
      assignedClassIds: [],
    };

    const teacherId = randomUUID();

    const year = await schoolRepo.createAcademicYear({
      code: '2026-2027',
      name: 'Năm học 2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-05-31',
      isCurrent: true,
    });

    const class6A1 = await schoolRepo.createClass({
      academicYearId: year.id,
      code: '6A1',
      name: 'Lớp 6A1',
      gradeLevel: 6,
    });

    const class6A2 = await schoolRepo.createClass({
      academicYearId: year.id,
      code: '6A2',
      name: 'Lớp 6A2',
      gradeLevel: 6,
    });

    await schoolRepo.assignTeacherToClass({
      teacherId,
      classId: class6A1.id,
      roleInClass: 'HOMEROOM',
    });

    const teacherActor: AuthenticatedUser = {
      id: teacherId,
      email: 'teacher6a1@school.edu.vn',
      fullName: 'Cô Nguyễn Thị Lan',
      roles: [ROLES.TEACHER],
      assignedClassIds: [class6A1.id],
    };

    const baseTime = new Date('2026-11-04T08:00:00.000Z');

    // Tablet 1: ONLINE at session start (heartbeat 5s ago)
    const hbOnline = await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'dpc-tab-online-01',
        serialNumber: 'SN-ONLINE-01',
        manufacturer: 'Samsung',
        model: 'Galaxy Tab A9',
        androidVersion: '14',
        sdkVersion: 34,
        batteryLevel: 90,
        installedApps: [
          {
            packageName: 'vn.manabie.learner',
            name: 'Manabie Learner',
            versionName: '2.4.0',
            versionCode: 20400,
          },
        ],
      },
      new Date(baseTime.getTime() - 5_000),
    );

    // Tablet 2: OFFLINE at session start (last heartbeat 10 minutes ago)
    const hbOffline = await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'dpc-tab-offline-02',
        serialNumber: 'SN-OFFLINE-02',
        manufacturer: 'Samsung',
        model: 'Galaxy Tab A9',
        androidVersion: '14',
        sdkVersion: 34,
        batteryLevel: 45,
        installedApps: [],
      },
      new Date(baseTime.getTime() - 10 * 60_000),
    );

    await devicesService.assignDeviceToClass(adminActor, hbOnline.deviceId, {
      classId: class6A1.id,
    });
    await devicesService.assignDeviceToClass(adminActor, hbOffline.deviceId, {
      classId: class6A1.id,
    });

    const policy = await policiesService.createPolicy(adminActor, {
      code: 'MATH-KIOSK-V1',
      name: 'Chế độ Kiosk Tiết Toán',
      initialRules: {
        kioskModeEnabled: true,
        kioskPackageName: 'vn.manabie.learner',
        appAllowlistEnabled: true,
        allowedPackages: ['vn.manabie.learner'],
        urlFilteringEnabled: false,
        allowedDomains: [],
        lockScreenDisabled: false,
      },
    });

    const publishedPolicy = await policiesService.publishPolicyVersion(
      adminActor,
      policy.id,
      policy.versions[0]!.id,
      MDM_PROVIDER_TYPES.CLASSROOM_DPC,
    );

    return {
      adminActor,
      teacherActor,
      class6A1,
      class6A2,
      onlineDeviceId: hbOnline.deviceId,
      offlineDeviceId: hbOffline.deviceId,
      publishedPolicy,
      baseTime,
      devicesService,
      commandsService,
      sessionsService,
      realtimeGateway,
      dashboardService,
    };
  }

  it('handles active session with online & offline tablets, auto-reconciles when offline tablet reconnects, and never fakes release on session end', async () => {
    const {
      teacherActor,
      class6A1,
      onlineDeviceId,
      offlineDeviceId,
      publishedPolicy,
      baseTime,
      devicesService,
      commandsService,
      sessionsService,
    } = await setupStack();

    const session = await sessionsService.createSession(
      teacherActor,
      {
        classId: class6A1.id,
        policyId: publishedPolicy.id,
        title: 'Tiết 1: Toán Hình Học',
        subjectName: 'Toán 6',
        scheduledStartAt: '2026-11-04T08:00:00.000Z',
        scheduledEndAt: '2026-11-04T08:45:00.000Z',
      },
      baseTime,
    );

    expect(session.status).toBe('SCHEDULED');
    expect(session.devices).toHaveLength(2);

    // 1. Start session at baseTime
    const started = await sessionsService.startSession(teacherActor, session.id, {
      now: baseTime,
    });

    expect(started.status).toBe('ACTIVE');
    const onlineEntry = started.devices.find((d) => d.deviceId === onlineDeviceId)!;
    const offlineEntry = started.devices.find((d) => d.deviceId === offlineDeviceId)!;

    // Online device has command dispatched (POLICY_SENT), waiting for tablet ACK
    expect(onlineEntry.syncState).toBe('POLICY_SENT');
    expect(onlineEntry.applyCommandId).toBeTruthy();

    // Offline device is honestly marked WAITING_DEVICE_ONLINE
    expect(offlineEntry.syncState).toBe('WAITING_DEVICE_ONLINE');
    expect(offlineEntry.applyCommandId).toBeNull();

    // 2. Online tablet acknowledges SUCCESS -> state becomes POLICY_APPLIED
    const applyCmd = commandsService.getCommandById(onlineEntry.applyCommandId!);
    await devicesService.processAgentCommandAck(applyCmd.externalCommandId!, {
      status: COMMAND_STATUSES.SUCCESS,
    });
    await sessionsService.reconcileSessionDeviceOnCommandUpdate(applyCmd.id);

    const afterOnlineAck = await sessionsService.getSessionById(teacherActor, session.id);
    expect(
      afterOnlineAck.devices.find((d) => d.deviceId === onlineDeviceId)?.syncState,
    ).toBe('POLICY_APPLIED');

    // 3. Offline tablet comes back ONLINE 3 minutes into the lesson and sends heartbeat
    const reconnectTime = new Date(baseTime.getTime() + 3 * 60_000);
    await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'dpc-tab-offline-02',
        serialNumber: 'SN-OFFLINE-02',
        manufacturer: 'Samsung',
        model: 'Galaxy Tab A9',
        androidVersion: '14',
        sdkVersion: 34,
        batteryLevel: 50,
        installedApps: [],
      },
      reconnectTime,
    );

    const reconcileResult = await sessionsService.reconcileDeviceOnHeartbeat(
      offlineDeviceId,
      reconnectTime,
    );
    expect(reconcileResult.reconciledSessionIds).toContain(session.id);

    const afterReconnect = await sessionsService.getSessionById(teacherActor, session.id);
    const reconnectedEntry = afterReconnect.devices.find((d) => d.deviceId === offlineDeviceId)!;
    expect(reconnectedEntry.syncState).toBe('POLICY_SENT');
    expect(reconnectedEntry.applyCommandId).toBeTruthy();

    // 4. End session at 08:45 when onlineDevice is still online (via fresh heartbeat) but offlineDevice lost Wi-Fi again
    const endTime = new Date('2026-11-04T08:45:00.000Z');
    await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'dpc-tab-online-01',
        serialNumber: 'SN-ONLINE-01',
        manufacturer: 'Samsung',
        model: 'Galaxy Tab A9',
        androidVersion: '14',
        sdkVersion: 34,
        batteryLevel: 82,
        installedApps: [],
      },
      new Date(endTime.getTime() - 5_000),
    );

    const ended = await sessionsService.endSession(teacherActor, session.id, {
      now: endTime,
    });

    expect(ended.status).toBe('ENDED');
    const endedOnline = ended.devices.find((d) => d.deviceId === onlineDeviceId)!;
    const endedOffline = ended.devices.find((d) => d.deviceId === offlineDeviceId)!;

    // Online device has release command SENT (NOT yet marked RELEASED until ACK)
    expect(endedOnline.syncState).toBe('RELEASE_SENT');
    expect(endedOnline.releaseCommandId).toBeTruthy();

    // Offline device is marked WAITING_RELEASE_ONLINE (never falsely marked RELEASED)
    expect(endedOffline.syncState).toBe('WAITING_RELEASE_ONLINE');
    expect(endedOffline.releasedAt).toBeNull();

    // Once online tablet acknowledges release command SUCCESS -> state becomes RELEASED
    const releaseCmd = commandsService.getCommandById(endedOnline.releaseCommandId!);
    await devicesService.processAgentCommandAck(releaseCmd.externalCommandId!, {
      status: COMMAND_STATUSES.SUCCESS,
    });
    await sessionsService.reconcileSessionDeviceOnCommandUpdate(releaseCmd.id);

    const finalSession = await sessionsService.getSessionById(teacherActor, session.id);
    expect(
      finalSession.devices.find((d) => d.deviceId === onlineDeviceId)?.syncState,
    ).toBe('RELEASED');
  });

  it('enforces Socket.IO room RBAC and provides accurate Dashboard, Audit Log & Report metrics', async () => {
    const {
      adminActor,
      teacherActor,
      class6A1,
      class6A2,
      baseTime,
      realtimeGateway,
      dashboardService,
    } = await setupStack();

    // Teacher can subscribe to assigned class6A1 room
    const subOk = await realtimeGateway.subscribeToClassRoom(teacherActor, class6A1.id);
    expect(subOk.subscribed).toBe(true);
    expect(subOk.room).toBe(`class:${class6A1.id}`);

    // Teacher is forbidden from subscribing to unassigned class6A2 room
    await expect(
      realtimeGateway.subscribeToClassRoom(teacherActor, class6A2.id),
    ).rejects.toThrow(ForbiddenException);

    // Emit notification and check alerts
    realtimeGateway.createAndEmitNotification({
      recipientUserId: teacherActor.id,
      title: 'Cảnh báo thiết bị ngoại tuyến',
      message: 'Tablet SN-OFFLINE-02 trong lớp 6A1 đang ngoại tuyến.',
      severity: 'WARNING',
    });

    const alerts = await dashboardService.getAlerts(teacherActor);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.severity).toBe('WARNING');

    const events = realtimeGateway.getEmittedEvents();
    expect(events.some((e) => e.event === REALTIME_EVENTS.NOTIFICATION_CREATED)).toBe(true);

    // Dashboard summary for teacher only counts teacher's assigned classes
    const teacherSummary = await dashboardService.getSummary(teacherActor, baseTime);
    expect(teacherSummary.totalClasses).toBe(1);
    expect(teacherSummary.totalDevices).toBe(2);
    expect(teacherSummary.onlineDevices).toBe(1);
    expect(teacherSummary.offlineDevices).toBe(1);

    // Admin report overview
    const report = await dashboardService.getReportOverview(adminActor, baseTime);
    expect(report.deviceStatusBreakdown.ONLINE).toBe(1);
    expect(report.deviceStatusBreakdown.OFFLINE).toBe(1);
    expect(report.topInstalledApps[0]?.packageName).toBe('vn.manabie.learner');
  });
});
