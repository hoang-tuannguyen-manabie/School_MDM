import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ROLES,
  type AcademicYearDto,
  type ApiResponse,
  type AuthenticatedUser,
  type SchoolClassDto,
  type StudentDto,
  type TeacherClassAssignmentDto,
  type UserSummaryDto,
} from '@school-mdm/contracts';
import type {
  AssignTeacherToClassInput,
  CreateAcademicYearInput,
  CreateSchoolClassInput,
  CreateStudentInput,
  CreateUserInput,
  UpdateSchoolClassInput,
} from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { SchoolService } from './school.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get('users')
  @Roles(ROLES.ADMIN)
  async listUsers(@Req() req: AuthenticatedRequest): Promise<ApiResponse<UserSummaryDto[]>> {
    const actor = this.requireUser(req);
    const data = await this.schoolService.listUsers(actor);
    return this.wrapResponse(data);
  }

  @Post('users')
  @Roles(ROLES.ADMIN)
  async createUser(
    @Body() body: CreateUserInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<UserSummaryDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.createUser(actor, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  @Get('academic-years')
  async listAcademicYears(): Promise<ApiResponse<AcademicYearDto[]>> {
    const data = await this.schoolService.listAcademicYears();
    return this.wrapResponse(data);
  }

  @Post('academic-years')
  @Roles(ROLES.ADMIN)
  async createAcademicYear(
    @Body() body: CreateAcademicYearInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<AcademicYearDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.createAcademicYear(actor, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  @Get('classes')
  async listClasses(@Req() req: AuthenticatedRequest): Promise<ApiResponse<SchoolClassDto[]>> {
    const actor = this.requireUser(req);
    const data = await this.schoolService.listClassesForActor(actor);
    return this.wrapResponse(data);
  }

  @Post('classes')
  @Roles(ROLES.ADMIN)
  async createClass(
    @Body() body: CreateSchoolClassInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SchoolClassDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.createClass(actor, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  @Get('classes/:id')
  async getClassDetail(
    @Param('id') classId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SchoolClassDto>> {
    const actor = this.requireUser(req);
    const data = await this.schoolService.getClassDetailForActor(actor, classId);
    return this.wrapResponse(data);
  }

  @Patch('classes/:id')
  @Roles(ROLES.ADMIN)
  async updateClass(
    @Param('id') classId: string,
    @Body() body: UpdateSchoolClassInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<SchoolClassDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.updateClass(actor, classId, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  @Post('classes/:id/teachers')
  @Roles(ROLES.ADMIN)
  async assignTeacher(
    @Param('id') classId: string,
    @Body() body: AssignTeacherToClassInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<TeacherClassAssignmentDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.assignTeacherToClass(actor, classId, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  @Delete('classes/:id/teachers/:teacherId')
  @Roles(ROLES.ADMIN)
  async revokeTeacher(
    @Param('id') classId: string,
    @Param('teacherId') teacherId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<{ revoked: true }>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.revokeTeacherFromClass(
      actor,
      classId,
      teacherId,
      requestId,
    );
    return this.wrapResponse(data, requestId);
  }

  @Get('classes/:id/students')
  async listStudents(
    @Param('id') classId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<StudentDto[]>> {
    const actor = this.requireUser(req);
    const data = await this.schoolService.listStudentsInClassForActor(actor, classId);
    return this.wrapResponse(data);
  }

  @Post('classes/:id/students')
  @Roles(ROLES.ADMIN)
  async createStudent(
    @Param('id') classId: string,
    @Body() body: CreateStudentInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<StudentDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const data = await this.schoolService.createStudentInClass(actor, classId, body, requestId);
    return this.wrapResponse(data, requestId);
  }

  private requireUser(req: AuthenticatedRequest): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực người dùng');
    }
    return req.user;
  }

  private wrapResponse<T>(data: T, requestId = randomUUID()): ApiResponse<T> {
    return {
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
