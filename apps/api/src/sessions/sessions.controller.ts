import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ROLES, type ApiResponse } from '@school-mdm/contracts';
import type { CreateClassSessionInput } from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async listSessions(
    @Req() req: AuthenticatedRequest,
    @Query('classId') classId?: string,
  ): Promise<ApiResponse<unknown>> {
    const items = await this.sessionsService.listSessions(req.user!, classId);
    return {
      data: items,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get(':id')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async getSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    const detail = await this.sessionsService.getSessionById(req.user!, id);
    return {
      data: detail,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post()
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async createSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateClassSessionInput,
  ): Promise<ApiResponse<unknown>> {
    const requestId = randomUUID();
    const created = await this.sessionsService.createSession(
      req.user!,
      body,
      new Date(),
      requestId,
    );
    return {
      data: created,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post(':id/start')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async startSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    const requestId = randomUUID();
    const started = await this.sessionsService.startSession(req.user!, id, {
      requestId,
    });
    return {
      data: started,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post(':id/end')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async endSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    const requestId = randomUUID();
    const ended = await this.sessionsService.endSession(req.user!, id, {
      requestId,
    });
    return {
      data: ended,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
