import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ApiResponse,
  AuthenticatedUser,
  DeviceCommandDetailDto,
} from '@school-mdm/contracts';
import type { DispatchDeviceCommandInput } from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { CommandsService } from './commands.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommandsController {
  constructor(private readonly commandsService: CommandsService) {}

  @Post('devices/:id/commands')
  async dispatchDeviceCommand(
    @Param('id') deviceId: string,
    @Body() body: DispatchDeviceCommandInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceCommandDetailDto>> {
    const actor = this.requireUser(req);
    const requestId = randomUUID();
    const command = await this.commandsService.dispatchCommand(actor, deviceId, body, {
      requestId,
    });

    return {
      data: command,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('devices/:id/commands')
  listDeviceCommands(
    @Param('id') deviceId: string,
  ): ApiResponse<DeviceCommandDetailDto[]> {
    const list = this.commandsService.listCommandsForDevice(deviceId);
    return {
      data: list,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('commands/:commandId')
  async getCommandDetail(
    @Param('commandId') commandId: string,
  ): Promise<ApiResponse<DeviceCommandDetailDto>> {
    const command = await this.commandsService.syncCommandStatusFromProvider(commandId);
    return {
      data: command,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('commands/:commandId/retry')
  @HttpCode(HttpStatus.OK)
  async retryCommand(
    @Param('commandId') commandId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<DeviceCommandDetailDto>> {
    const actor = this.requireUser(req);
    const retried = await this.commandsService.retryCommand(actor, commandId);

    return {
      data: retried,
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
}
