import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_STATUSES, ROLES, type AuthenticatedUser } from '@school-mdm/contracts';
import { InMemoryAuthRepository } from '../auth/auth.repository';
import { ClassroomDpcAdapter } from '../mdm/adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from '../mdm/adapters/headwind.adapter';
import { DeviceSyncService } from '../mdm/device-sync.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { InMemorySchoolRepository } from '../school/school.repository';
import { DevicesService } from './devices.service';

describe('DevicesService – Enrollment, Assignment History & Teacher Class Scope (Phase 5 & 6)', () => {
  let classroomAdapter: ClassroomDpcAdapter;
  let headwindAdapter: HeadwindAdapter;
  let providerService: MdmProviderService;
  let syncService: DeviceSyncService;
  let schoolRepo: InMemorySchoolRepository;
  let authRepo: InMemoryAuthRepository;
  let classScope: ClassScopeService;
  let devicesService: DevicesService;

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

  beforeEach(() => {
    classroomAdapter = new ClassroomDpcAdapter();
    headwindAdapter = new HeadwindAdapter();
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
  });

  it('maintains complete assignment history with strictly ONE active assignment per device', async () => {
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

    const class6A2 = await schoolRepo.createClass({
      academicYearId: year.id,
      code: '6A2',
      name: 'Lớp 6A2',
      gradeLevel: 6,
    });

    const hb = await devicesService.processAgentHeartbeat({
      externalDeviceId: 'tab-classroom-01',
      serialNumber: 'SN-TAB-01',
      manufacturer: 'Samsung',
      model: 'SM-X200',
      androidVersion: '13',
      sdkVersion: 33,
      batteryLevel: 92,
      installedApps: [
        {
          packageName: 'vn.edu.school.math',
          name: 'Toán Lớp 6',
          versionName: '1.0.0',
          versionCode: 10,
        },
      ],
    });

    // First assignment to 6A1
    await devicesService.assignDeviceToClass(adminActor, hb.deviceId, {
      classId: class6A1.id,
      notes: 'Gán đầu năm học cho lớp 6A1',
    });

    // Reassign to 6A2 -> must close 6A1 assignment and activate 6A2 assignment
    await devicesService.assignDeviceToClass(adminActor, hb.deviceId, {
      classId: class6A2.id,
      notes: 'Điều chuyển sang lớp 6A2 học tiết Tin học',
    });

    const detail = await devicesService.getDeviceDetail(adminActor, hb.deviceId);
    expect(detail.activeClassId).toBe(class6A2.id);
    expect(detail.assignmentHistory).toHaveLength(2);

    const activeAssignments = detail.assignmentHistory.filter((a) => a.isActive);
    expect(activeAssignments).toHaveLength(1);
    expect(activeAssignments[0]?.classId).toBe(class6A2.id);

    const oldAssignment = detail.assignmentHistory.find((a) => a.classId === class6A1.id);
    expect(oldAssignment?.isActive).toBe(false);
    expect(oldAssignment?.unassignedAt).toBeTruthy();
  });

  it('restricts TEACHER device list & detail strictly to devices assigned to their class and transitions ONLINE -> OFFLINE when heartbeat expires', async () => {
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

    const class6A2 = await schoolRepo.createClass({
      academicYearId: year.id,
      code: '6A2',
      name: 'Lớp 6A2',
      gradeLevel: 6,
    });

    await schoolRepo.assignTeacherToClass({
      teacherId: teacherLanActor.id,
      classId: class6A1.id,
      roleInClass: 'HOMEROOM',
    });

    const t0 = new Date('2026-11-04T08:00:00.000Z');
    const dev1 = await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'tab-6a1-01',
        serialNumber: 'SN-6A1-01',
        manufacturer: 'Samsung',
        model: 'SM-X200',
        androidVersion: '13',
        sdkVersion: 33,
        batteryLevel: 80,
        installedApps: [],
      },
      t0,
    );

    const dev2 = await devicesService.processAgentHeartbeat(
      {
        externalDeviceId: 'tab-6a2-01',
        serialNumber: 'SN-6A2-01',
        manufacturer: 'Samsung',
        model: 'SM-X200',
        androidVersion: '13',
        sdkVersion: 33,
        batteryLevel: 75,
        installedApps: [],
      },
      t0,
    );

    await devicesService.assignDeviceToClass(adminActor, dev1.deviceId, { classId: class6A1.id });
    await devicesService.assignDeviceToClass(adminActor, dev2.deviceId, { classId: class6A2.id });

    // Teacher Lan listing devices 10s after heartbeat -> sees ONLY dev1 (ONLINE)
    const tenSecondsLater = new Date(t0.getTime() + 10_000);
    const teacherListOnline = await devicesService.listDevices(
      teacherLanActor,
      {},
      tenSecondsLater,
    );
    expect(teacherListOnline.items).toHaveLength(1);
    expect(teacherListOnline.items[0]?.id).toBe(dev1.deviceId);
    expect(teacherListOnline.items[0]?.status).toBe(DEVICE_STATUSES.ONLINE);

    // 2 minutes later without a new heartbeat -> dev1 must be reported as OFFLINE, not assumed ONLINE
    const twoMinutesLater = new Date(t0.getTime() + 120_000);
    const teacherListOffline = await devicesService.listDevices(
      teacherLanActor,
      {},
      twoMinutesLater,
    );
    expect(teacherListOffline.items[0]?.status).toBe(DEVICE_STATUSES.OFFLINE);

    // Teacher Lan trying to view detail of dev2 (assigned to 6A2) is blocked with 403 Forbidden
    await expect(
      devicesService.getDeviceDetail(teacherLanActor, dev2.deviceId, tenSecondsLater),
    ).rejects.toThrow(ForbiddenException);
  });
});
