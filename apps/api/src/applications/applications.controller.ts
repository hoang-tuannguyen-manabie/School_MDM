import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  type ApiResponse,
  type ApplicationCatalogItemDto,
  type ApplicationDetailDto,
  type AuthenticatedUser,
  type DeviceCommandDetailDto,
} from '@school-mdm/contracts';
import type { CreateApplicationInput } from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { ApplicationsService } from './applications.service';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  listApplications(): ApiResponse<ApplicationCatalogItemDto[]> {
    return this.wrap(this.applicationsService.listApplications());
  }

  @Post()
  @Roles(ROLES.ADMIN)
  async createApplication(
    @Body() body: CreateApplicationInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<ApplicationCatalogItemDto>> {
    const actor = this.requireUser(req);
    const created = await this.applicationsService.createApplication(actor, body);
    return this.wrap(created);
  }

  @Get(':id')
  async getApplicationDetail(
    @Param('id') appId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<ApplicationDetailDto>> {
    const actor = this.requireUser(req);
    const detail = await this.applicationsService.getApplicationDetail(actor, appId);
    return this.wrap(detail);
  }

  @Patch(':id/approve')
  @Roles(ROLES.ADMIN)
  async approveApplication(
    @Param('id') appId: string,
    @Body() body: { isApproved: boolean },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<ApplicationCatalogItemDto>> {
    const actor = this.requireUser(req);
    const updated = await this.applicationsService.setApplicationApproval(
      actor,
      appId,
      Boolean(body.isApproved),
    );
    return this.wrap(updated);
  }

  @Post(':id/devices/:deviceId/install')
  @HttpCode(HttpStatus.OK)
  async installOnDevice(
    @Param('id') appId: string,
    @Param('deviceId') deviceId: string,
    @Body() body: { idempotencyKey?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceCommandDetailDto>> {
    const actor = this.requireUser(req);
    const command = await this.applicationsService.installOrUpdateAppOnDevice(
      actor,
      appId,
      deviceId,
      body.idempotencyKey ?? randomUUID(),
    );
    return this.wrap(command);
  }

  @Post(':id/devices/:deviceId/remove')
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeFromDevice(
    @Param('id') appId: string,
    @Param('deviceId') deviceId: string,
    @Body() body: { idempotencyKey?: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceCommandDetailDto>> {
    const actor = this.requireUser(req);
    const command = await this.applicationsService.removeAppFromDevice(
      actor,
      appId,
      deviceId,
      body.idempotencyKey ?? randomUUID(),
    );
    return this.wrap(command);
  }

  private requireUser(req: AuthenticatedRequest): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực người dùng');
    }
    return req.user;
  }

  private wrap<T>(data: T): ApiResponse<T> {
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
