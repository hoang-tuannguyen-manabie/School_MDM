import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ROLES, type ApiResponse } from '@school-mdm/contracts';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/summary')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async getSummary(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    const summary = await this.dashboardService.getSummary(req.user!);
    return {
      data: summary,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('dashboard/device-status')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async getDeviceStatus(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    const breakdown = await this.dashboardService.getDeviceStatusBreakdown(req.user!);
    return {
      data: breakdown,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('dashboard/recent-activity')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async getRecentActivity(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    const items = await this.dashboardService.getRecentActivity(req.user!);
    return {
      data: items,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('dashboard/alerts')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async getAlerts(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    const items = await this.dashboardService.getAlerts(req.user!);
    return {
      data: items,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('audit-logs')
  @Roles(ROLES.ADMIN, ROLES.TEACHER)
  async listAuditLogs(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const parsedLimit = limit ? Math.min(200, Math.max(1, Number(limit))) : 50;
    const logs = await this.dashboardService.listAuditLogs(req.user!, parsedLimit);
    return {
      data: logs,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('reports/overview')
  @Roles(ROLES.ADMIN)
  async getReportOverview(@Req() req: AuthenticatedRequest): Promise<ApiResponse<unknown>> {
    const report = await this.dashboardService.getReportOverview(req.user!);
    return {
      data: report,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
