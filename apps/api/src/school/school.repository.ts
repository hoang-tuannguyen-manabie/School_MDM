import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AcademicYearDto,
  RoleName,
  SchoolClassDto,
  StudentDto,
  TeacherClassAssignmentDto,
  UserSummaryDto,
} from '@school-mdm/contracts';

export interface StoredSchoolUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  roles: RoleName[];
  createdAt: Date;
}

export abstract class SchoolRepositoryPort {
  abstract createUser(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
    roles: RoleName[];
  }): Promise<UserSummaryDto>;
  abstract listUsers(): Promise<UserSummaryDto[]>;
  abstract findUserById(userId: string): Promise<UserSummaryDto | null>;

  abstract createAcademicYear(input: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }): Promise<AcademicYearDto>;
  abstract listAcademicYears(): Promise<AcademicYearDto[]>;
  abstract findAcademicYearById(id: string): Promise<AcademicYearDto | null>;

  abstract createClass(input: {
    academicYearId: string;
    code: string;
    name: string;
    gradeLevel: number;
    roomName?: string;
  }): Promise<SchoolClassDto>;
  abstract updateClass(
    classId: string,
    patch: {
      name?: string;
      gradeLevel?: number;
      roomName?: string | null;
      isActive?: boolean;
    },
  ): Promise<SchoolClassDto>;
  abstract findClassById(classId: string): Promise<SchoolClassDto | null>;
  abstract listAllClasses(): Promise<SchoolClassDto[]>;
  abstract listClassesByIds(classIds: string[]): Promise<SchoolClassDto[]>;

  abstract assignTeacherToClass(input: {
    teacherId: string;
    classId: string;
    roleInClass: 'HOMEROOM' | 'SUBJECT';
  }): Promise<TeacherClassAssignmentDto>;
  abstract revokeTeacherFromClass(teacherId: string, classId: string): Promise<void>;
  abstract getActiveClassIdsForTeacher(teacherId: string): Promise<string[]>;

  abstract createStudent(input: {
    classId: string;
    studentCode: string;
    fullName: string;
    dateOfBirth?: string;
  }): Promise<StudentDto>;
  abstract listStudentsByClassId(classId: string): Promise<StudentDto[]>;
}

@Injectable()
export class InMemorySchoolRepository extends SchoolRepositoryPort {
  private readonly users = new Map<string, StoredSchoolUser>();
  private readonly academicYears = new Map<string, AcademicYearDto>();
  private readonly classes = new Map<string, Omit<SchoolClassDto, 'teacherIds'>>();
  private readonly teacherAssignments = new Map<string, TeacherClassAssignmentDto>();
  private readonly students = new Map<string, StudentDto>();

  override async createUser(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
    roles: RoleName[];
  }): Promise<UserSummaryDto> {
    const normalizedEmail = input.email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email === normalizedEmail) {
        throw new ConflictException(`Email ${normalizedEmail} đã tồn tại`);
      }
    }

    const user: StoredSchoolUser = {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      isActive: true,
      roles: [...input.roles],
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return this.toUserSummaryDto(user);
  }

  override async listUsers(): Promise<UserSummaryDto[]> {
    const summaries: UserSummaryDto[] = [];
    for (const u of this.users.values()) {
      summaries.push(await this.toUserSummaryDto(u));
    }
    return summaries;
  }

  override async findUserById(userId: string): Promise<UserSummaryDto | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    return this.toUserSummaryDto(user);
  }

  override async createAcademicYear(input: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  }): Promise<AcademicYearDto> {
    for (const y of this.academicYears.values()) {
      if (y.code === input.code) {
        throw new ConflictException(`Mã năm học ${input.code} đã tồn tại`);
      }
    }

    if (input.isCurrent) {
      for (const y of this.academicYears.values()) {
        y.isCurrent = false;
      }
    }

    const created: AcademicYearDto = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent,
      createdAt: new Date().toISOString(),
    };
    this.academicYears.set(created.id, created);
    return { ...created };
  }

  override async listAcademicYears(): Promise<AcademicYearDto[]> {
    return Array.from(this.academicYears.values()).map((y) => ({ ...y }));
  }

  override async findAcademicYearById(id: string): Promise<AcademicYearDto | null> {
    const found = this.academicYears.get(id);
    return found ? { ...found } : null;
  }

  override async createClass(input: {
    academicYearId: string;
    code: string;
    name: string;
    gradeLevel: number;
    roomName?: string;
  }): Promise<SchoolClassDto> {
    if (!this.academicYears.has(input.academicYearId)) {
      throw new NotFoundException('Không tìm thấy năm học');
    }

    for (const c of this.classes.values()) {
      if (c.academicYearId === input.academicYearId && c.code === input.code) {
        throw new ConflictException(`Mã lớp ${input.code} đã tồn tại trong năm học này`);
      }
    }

    const created = {
      id: randomUUID(),
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      gradeLevel: input.gradeLevel,
      roomName: input.roomName ?? null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.classes.set(created.id, created);
    return this.toSchoolClassDto(created);
  }

  override async updateClass(
    classId: string,
    patch: {
      name?: string;
      gradeLevel?: number;
      roomName?: string | null;
      isActive?: boolean;
    },
  ): Promise<SchoolClassDto> {
    const existing = this.classes.get(classId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    if (patch.name !== undefined) existing.name = patch.name;
    if (patch.gradeLevel !== undefined) existing.gradeLevel = patch.gradeLevel;
    if (patch.roomName !== undefined) existing.roomName = patch.roomName;
    if (patch.isActive !== undefined) existing.isActive = patch.isActive;

    return this.toSchoolClassDto(existing);
  }

  override async findClassById(classId: string): Promise<SchoolClassDto | null> {
    const existing = this.classes.get(classId);
    if (!existing) {
      return null;
    }
    return this.toSchoolClassDto(existing);
  }

  override async listAllClasses(): Promise<SchoolClassDto[]> {
    return Array.from(this.classes.values()).map((c) => this.toSchoolClassDto(c));
  }

  override async listClassesByIds(classIds: string[]): Promise<SchoolClassDto[]> {
    const idSet = new Set(classIds);
    return Array.from(this.classes.values())
      .filter((c) => idSet.has(c.id))
      .map((c) => this.toSchoolClassDto(c));
  }

  override async assignTeacherToClass(input: {
    teacherId: string;
    classId: string;
    roleInClass: 'HOMEROOM' | 'SUBJECT';
  }): Promise<TeacherClassAssignmentDto> {
    const key = `${input.teacherId}:${input.classId}`;
    const assignment: TeacherClassAssignmentDto = {
      id: randomUUID(),
      teacherId: input.teacherId,
      classId: input.classId,
      roleInClass: input.roleInClass,
      isActive: true,
      assignedAt: new Date().toISOString(),
    };
    this.teacherAssignments.set(key, assignment);
    return { ...assignment };
  }

  override async revokeTeacherFromClass(teacherId: string, classId: string): Promise<void> {
    const key = `${teacherId}:${classId}`;
    const existing = this.teacherAssignments.get(key);
    if (existing) {
      existing.isActive = false;
    }
  }

  override async getActiveClassIdsForTeacher(teacherId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const assignment of this.teacherAssignments.values()) {
      if (assignment.teacherId === teacherId && assignment.isActive) {
        ids.push(assignment.classId);
      }
    }
    return ids;
  }

  override async createStudent(input: {
    classId: string;
    studentCode: string;
    fullName: string;
    dateOfBirth?: string;
  }): Promise<StudentDto> {
    for (const s of this.students.values()) {
      if (s.studentCode === input.studentCode) {
        throw new ConflictException(`Mã học sinh ${input.studentCode} đã tồn tại`);
      }
    }

    const created: StudentDto = {
      id: randomUUID(),
      classId: input.classId,
      studentCode: input.studentCode,
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth ?? null,
      isActive: true,
    };
    this.students.set(created.id, created);
    return { ...created };
  }

  override async listStudentsByClassId(classId: string): Promise<StudentDto[]> {
    return Array.from(this.students.values())
      .filter((s) => s.classId === classId && s.isActive)
      .map((s) => ({ ...s }));
  }

  private async toUserSummaryDto(user: StoredSchoolUser): Promise<UserSummaryDto> {
    const assignedClassIds = await this.getActiveClassIdsForTeacher(user.id);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      roles: [...user.roles],
      assignedClassIds,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private toSchoolClassDto(raw: Omit<SchoolClassDto, 'teacherIds'>): SchoolClassDto {
    const teacherIds: string[] = [];
    for (const a of this.teacherAssignments.values()) {
      if (a.classId === raw.id && a.isActive) {
        teacherIds.push(a.teacherId);
      }
    }
    return {
      ...raw,
      teacherIds,
    };
  }
}
