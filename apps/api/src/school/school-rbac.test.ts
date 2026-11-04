import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES, type AuthenticatedUser } from '@school-mdm/contracts';
import { InMemoryAuthRepository } from '../auth/auth.repository';
import { PasswordService } from '../auth/password.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { InMemorySchoolRepository } from './school.repository';
import { SchoolService } from './school.service';

describe('SchoolService & RBAC Class Scope Enforcement (Phase 3)', () => {
  let schoolRepo: InMemorySchoolRepository;
  let authRepo: InMemoryAuthRepository;
  let passwordService: PasswordService;
  let classScope: ClassScopeService;
  let schoolService: SchoolService;

  const adminActor: AuthenticatedUser = {
    id: randomUUID(),
    email: 'admin@school.local',
    fullName: 'Quản trị viên Hệ thống',
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
    schoolRepo = new InMemorySchoolRepository();
    authRepo = new InMemoryAuthRepository();
    passwordService = new PasswordService();
    classScope = new ClassScopeService();
    schoolService = new SchoolService(schoolRepo, authRepo, passwordService, classScope);
  });

  it('allows ADMIN to create academic year, classes, students, and assign teachers with audit logs', async () => {
    const year = await schoolService.createAcademicYear(
      adminActor,
      {
        code: '2026-2027',
        name: 'Năm học 2026 - 2027',
        startDate: '2026-09-05',
        endDate: '2027-05-31',
        isCurrent: true,
      },
      randomUUID(),
    );

    const class6A1 = await schoolService.createClass(
      adminActor,
      {
        academicYearId: year.id,
        code: '6A1',
        name: 'Lớp 6A1',
        gradeLevel: 6,
        roomName: 'Phòng B201',
      },
      randomUUID(),
    );

    const assignment = await schoolService.assignTeacherToClass(
      adminActor,
      class6A1.id,
      {
        teacherId: teacherLanActor.id,
        roleInClass: 'HOMEROOM',
      },
      randomUUID(),
    );

    expect(assignment.isActive).toBe(true);
    expect(authRepo.getAuditLogs()).toHaveLength(3);
  });

  it('enforces strict class scope for TEACHER: only sees assigned classes and blocks unassigned classes with 403 Forbidden', async () => {
    const year = await schoolService.createAcademicYear(
      adminActor,
      {
        code: '2026-2027',
        name: 'Năm học 2026 - 2027',
        startDate: '2026-09-05',
        endDate: '2027-05-31',
        isCurrent: true,
      },
      randomUUID(),
    );

    const class6A1 = await schoolService.createClass(
      adminActor,
      {
        academicYearId: year.id,
        code: '6A1',
        name: 'Lớp 6A1 (Phân công cô Lan)',
        gradeLevel: 6,
      },
      randomUUID(),
    );

    const class6A2 = await schoolService.createClass(
      adminActor,
      {
        academicYearId: year.id,
        code: '6A2',
        name: 'Lớp 6A2 (Lớp của giáo viên khác)',
        gradeLevel: 6,
      },
      randomUUID(),
    );

    await schoolService.assignTeacherToClass(
      adminActor,
      class6A1.id,
      {
        teacherId: teacherLanActor.id,
        roleInClass: 'HOMEROOM',
      },
      randomUUID(),
    );

    await schoolService.createStudentInClass(
      adminActor,
      class6A1.id,
      {
        studentCode: 'HS6A1-001',
        fullName: 'Trần Minh Khang',
      },
      randomUUID(),
    );

    // Teacher listing classes MUST only receive 6A1, never 6A2
    const teacherVisibleClasses = await schoolService.listClassesForActor(teacherLanActor);
    expect(teacherVisibleClasses).toHaveLength(1);
    expect(teacherVisibleClasses[0]?.code).toBe('6A1');

    // Teacher can view students in assigned class 6A1
    const studentsIn6A1 = await schoolService.listStudentsInClassForActor(
      teacherLanActor,
      class6A1.id,
    );
    expect(studentsIn6A1).toHaveLength(1);

    // Teacher attempting to view unassigned class 6A2 detail or students is blocked at Backend with 403 Forbidden
    await expect(
      schoolService.getClassDetailForActor(teacherLanActor, class6A2.id),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      schoolService.listStudentsInClassForActor(teacherLanActor, class6A2.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks TEACHER from performing ADMIN-only school management mutations', async () => {
    await expect(
      schoolService.createAcademicYear(
        teacherLanActor,
        {
          code: '2027-2028',
          name: 'Năm học 2027 - 2028',
          startDate: '2027-09-05',
          endDate: '2028-05-31',
          isCurrent: false,
        },
        randomUUID(),
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(schoolService.listUsers(teacherLanActor)).rejects.toThrow(ForbiddenException);
  });
});
