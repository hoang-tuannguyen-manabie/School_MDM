import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ROLES,
  type ApiResponse,
  type AuthenticatedUser,
  type DeviceAssignmentRecordDto,
  type DeviceDetailDto,
  type DeviceSummaryDto,
} from '@school-mdm/contracts';
import type {
  AgentCommandAckInput,
  AgentHeartbeatInput,
  AssignDeviceToClassInput,
  DeviceListFilterInput,
} from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { DeviceSyncService, type MdmSyncRunRecord } from '../mdm/device-sync.service';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { DevicesService } from './devices.service';

@Controller()
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly deviceSyncService: DeviceSyncService,
  ) {}

  @Post('mdm/agent/heartbeat')
  @HttpCode(HttpStatus.OK)
  async receiveAgentHeartbeat(
    @Headers('x-classroom-dpc-secret') secret: string | undefined,
    @Body() body: AgentHeartbeatInput,
  ): Promise<ApiResponse<{ deviceId: string; status: string }>> {
    this.verifyAgentSharedSecret(secret);
    const result = await this.devicesService.processAgentHeartbeat(body);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('devices/probe-connection')
  @HttpCode(HttpStatus.OK)
  async probeConnection(
    @Body()
    body: {
      target: string;
    },
  ) {
    const result = await this.devicesService.probeDeviceConnection(body.target);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('devices/pre-register')
  @HttpCode(HttpStatus.OK)
  async preRegisterDevice(
    @Body()
    body: {
      androidId?: string;
      imei?: string;
      serialNumber?: string;
      ipAddress?: string;
      macAddress?: string;
      name: string;
      classCode?: string;
      isOnline?: boolean;
      latencyMs?: number;
      model?: string;
      batteryLevel?: number;
    },
  ) {
    const record = this.devicesService.preRegisterDevice(body);
    return {
      data: record,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('devices/classroom-status')
  async getClassroomStatus(@Query('classCode') classCode?: string) {
    const list = this.devicesService.getClassroomDevices(classCode);
    return {
      data: list,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Delete('devices/pre-register/:id')
  async deletePreRegisteredDevice(@Param('id') id: string) {
    const result = this.devicesService.deletePreRegisteredDevice(id);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('devices/batch-assign')
  @HttpCode(HttpStatus.OK)
  async batchAssignDevices(
    @Body()
    body: {
      deviceIds: string[];
      classCode: string;
    },
  ) {
    const result = this.devicesService.batchAssignClass(body.deviceIds || [], body.classCode);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('mdm/agent/commands/:externalCommandId/ack')
  @HttpCode(HttpStatus.OK)
  async receiveAgentCommandAck(
    @Headers('x-classroom-dpc-secret') secret: string | undefined,
    @Param('externalCommandId') externalCommandId: string,
    @Body() body: AgentCommandAckInput,
  ): Promise<ApiResponse<{ externalCommandId: string; status: string }>> {
    this.verifyAgentSharedSecret(secret);
    const result = await this.devicesService.processAgentCommandAck(externalCommandId, body);
    return {
      data: result,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listDevices(
    @Query() query: Partial<DeviceListFilterInput>,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceSummaryDto[]>> {
    const actor = this.requireUser(req);
    const paginated = await this.devicesService.listDevices(actor, query);

    return {
      data: paginated.items,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        pagination: {
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalItems: paginated.totalItems,
          totalPages: paginated.totalPages,
        },
      },
    };
  }

  @Get('devices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getDeviceDetail(
    @Param('id') deviceId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceDetailDto>> {
    const actor = this.requireUser(req);
    const detail = await this.devicesService.getDeviceDetail(actor, deviceId);

    return {
      data: detail,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('devices/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncDevices(@Req() req: AuthenticatedRequest): Promise<ApiResponse<MdmSyncRunRecord>> {
    const actor = this.requireUser(req);
    const run = await this.deviceSyncService.syncDevices('MANUAL', actor);

    return {
      data: run,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('devices/:id/assign-class')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN)
  async assignDeviceToClass(
    @Param('id') deviceId: string,
    @Body() body: AssignDeviceToClassInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceAssignmentRecordDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const record = await this.devicesService.assignDeviceToClass(
      actor,
      deviceId,
      body,
      requestId,
    );

    return {
      data: record,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('classes/:id/devices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listDevicesInClass(
    @Param('id') classId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceSummaryDto[]>> {
    const actor = this.requireUser(req);
    const paginated = await this.devicesService.listDevices(actor, {
      classId,
      page: 1,
      pageSize: 100,
    });

    return {
      data: paginated.items,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  private requireUser(req: AuthenticatedRequest): AuthenticatedUser {
    if (!req.user) {
      throw new UnauthorizedException('Chưa xác thực người dùng');
    }
    return req.user;
  }

  private verifyAgentSharedSecret(providedSecret?: string): void {
    const expected =
      process.env.CLASSROOM_DPC_SHARED_SECRET ??
      'school_mdm_classroom_dpc_enrollment_secret_2026';
    if (!providedSecret || providedSecret !== expected) {
      throw new UnauthorizedException('Mã bí mật Classroom DPC Agent không hợp lệ');
    }
  }
}
