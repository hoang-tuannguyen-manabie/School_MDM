import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AcademicYearDto,
  AuthenticatedUser,
  SchoolClassDto,
  StudentDto,
  TeacherClassAssignmentDto,
  UserSummaryDto,
} from '@school-mdm/contracts';
import {
  assignTeacherToClassSchema,
  createAcademicYearSchema,
  createSchoolClassSchema,
  createStudentSchema,
  createUserSchema,
  updateSchoolClassSchema,
  type AssignTeacherToClassInput,
  type CreateAcademicYearInput,
  type CreateSchoolClassInput,
  type CreateStudentInput,
  type CreateUserInput,
  type UpdateSchoolClassInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { PasswordService } from '../auth/password.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { SchoolRepositoryPort } from './school.repository';

@Injectable()
export class SchoolService {
  constructor(
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly authRepo: AuthRepositoryPort,
    private readonly passwordService: PasswordService,
    private readonly classScope: ClassScopeService,
  ) {}

  async createUser(
    actor: AuthenticatedUser,
    rawInput: CreateUserInput,
    requestId: string,
  ): Promise<UserSummaryDto> {
    this.classScope.assertAdminRole(actor, 'Tạo tài khoản người dùng');

    const parsed = createUserSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ');
    }

    const passwordHash = this.passwordService.hashPassword(parsed.data.password);
    const created = await this.schoolRepo.createUser({
      email: parsed.data.email,
      passwordHash,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      roles: parsed.data.roles,
    });

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_USER_CREATED',
      targetType: 'USER',
      targetId: created.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { email: created.email, roles: created.roles },
    });

    return created;
  }

  async listUsers(actor: AuthenticatedUser): Promise<UserSummaryDto[]> {
    this.classScope.assertAdminRole(actor, 'Xem danh sách người dùng toàn trường');
    return this.schoolRepo.listUsers();
  }

  async createAcademicYear(
    actor: AuthenticatedUser,
    rawInput: CreateAcademicYearInput,
    requestId: string,
  ): Promise<AcademicYearDto> {
    this.classScope.assertAdminRole(actor, 'Tạo năm học mới');

    const parsed = createAcademicYearSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu năm học không hợp lệ');
    }

    const created = await this.schoolRepo.createAcademicYear(parsed.data);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_ACADEMIC_YEAR_CREATED',
      targetType: 'ACADEMIC_YEAR',
      targetId: created.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { code: created.code },
    });

    return created;
  }

  async listAcademicYears(): Promise<AcademicYearDto[]> {
    return this.schoolRepo.listAcademicYears();
  }

  async createClass(
    actor: AuthenticatedUser,
    rawInput: CreateSchoolClassInput,
    requestId: string,
  ): Promise<SchoolClassDto> {
    this.classScope.assertAdminRole(actor, 'Tạo lớp học mới');

    const parsed = createSchoolClassSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu lớp học không hợp lệ');
    }

    const created = await this.schoolRepo.createClass(parsed.data);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_CLASS_CREATED',
      targetType: 'CLASS',
      targetId: created.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { code: created.code, gradeLevel: created.gradeLevel },
    });

    return created;
  }

  async updateClass(
    actor: AuthenticatedUser,
    classId: string,
    rawInput: UpdateSchoolClassInput,
    requestId: string,
  ): Promise<SchoolClassDto> {
    this.classScope.assertAdminRole(actor, 'Cập nhật thông tin lớp học');

    const parsed = updateSchoolClassSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu cập nhật không hợp lệ');
    }

    const updated = await this.schoolRepo.updateClass(classId, parsed.data);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_CLASS_UPDATED',
      targetType: 'CLASS',
      targetId: updated.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: parsed.data,
    });

    return updated;
  }

  async listClassesForActor(actor: AuthenticatedUser): Promise<SchoolClassDto[]> {
    if (this.classScope.isAdmin(actor)) {
      return this.schoolRepo.listAllClasses();
    }

    const activeClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
    return this.schoolRepo.listClassesByIds(activeClassIds);
  }

  async getClassDetailForActor(
    actor: AuthenticatedUser,
    classId: string,
  ): Promise<SchoolClassDto> {
    const activeClassIds = this.classScope.isAdmin(actor)
      ? []
      : await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);

    this.classScope.assertCanAccessClass(actor, classId, activeClassIds);

    const found = await this.schoolRepo.findClassById(classId);
    if (!found) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    return found;
  }

  async assignTeacherToClass(
    actor: AuthenticatedUser,
    classId: string,
    rawInput: AssignTeacherToClassInput,
    requestId: string,
  ): Promise<TeacherClassAssignmentDto> {
    this.classScope.assertAdminRole(actor, 'Phân công giáo viên phụ trách lớp');

    const parsed = assignTeacherToClassSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu phân công không hợp lệ');
    }

    const targetClass = await this.schoolRepo.findClassById(classId);
    if (!targetClass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    const assignment = await this.schoolRepo.assignTeacherToClass({
      teacherId: parsed.data.teacherId,
      classId,
      roleInClass: parsed.data.roleInClass,
    });

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_TEACHER_ASSIGNED_TO_CLASS',
      targetType: 'CLASS',
      targetId: classId,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        teacherId: parsed.data.teacherId,
        roleInClass: parsed.data.roleInClass,
      },
    });

    return assignment;
  }

  async revokeTeacherFromClass(
    actor: AuthenticatedUser,
    classId: string,
    teacherId: string,
    requestId: string,
  ): Promise<{ revoked: true }> {
    this.classScope.assertAdminRole(actor, 'Thu hồi phân công giáo viên khỏi lớp');

    await this.schoolRepo.revokeTeacherFromClass(teacherId, classId);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_TEACHER_REVOKED_FROM_CLASS',
      targetType: 'CLASS',
      targetId: classId,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { teacherId },
    });

    return { revoked: true };
  }

  async createStudentInClass(
    actor: AuthenticatedUser,
    classId: string,
    rawInput: CreateStudentInput,
    requestId: string,
  ): Promise<StudentDto> {
    this.classScope.assertAdminRole(actor, 'Thêm học sinh vào lớp');

    const parsed = createStudentSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu học sinh không hợp lệ');
    }

    const targetClass = await this.schoolRepo.findClassById(classId);
    if (!targetClass) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    const created = await this.schoolRepo.createStudent({
      classId,
      studentCode: parsed.data.studentCode,
      fullName: parsed.data.fullName,
      dateOfBirth: parsed.data.dateOfBirth,
    });

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'SCHOOL_STUDENT_CREATED',
      targetType: 'STUDENT',
      targetId: created.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { classId, studentCode: created.studentCode },
    });

    return created;
  }

  async listStudentsInClassForActor(
    actor: AuthenticatedUser,
    classId: string,
  ): Promise<StudentDto[]> {
    const activeClassIds = this.classScope.isAdmin(actor)
      ? []
      : await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);

    this.classScope.assertCanAccessClass(actor, classId, activeClassIds);

    return this.schoolRepo.listStudentsByClassId(classId);
  }
}
