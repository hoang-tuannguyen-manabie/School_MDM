import { Injectable } from '@nestjs/common';
import {
  COMMAND_STATUSES,
  DEVICE_STATUSES,
  type AuditLogItemDto,
  type AuthenticatedUser,
  type ClassSessionStatus,
  type CommandStatus,
  type DashboardSummaryDto,
  type DeviceStatus,
  type NotificationItemDto,
  type ReportOverviewDto,
} from '@school-mdm/contracts';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { CommandsService } from '../commands/commands.service';
import { DevicesService } from '../devices/devices.service';
import { DeviceSyncService } from '../mdm/device-sync.service';
import { ClassScopeService } from '../rbac/class-scope.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SchoolRepositoryPort } from '../school/school.repository';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly schoolRepo: SchoolRepositoryPort,
    private readonly classScope: ClassScopeService,
    private readonly devicesService: DevicesService,
    private readonly deviceSyncService: DeviceSyncService,
    private readonly commandsService: CommandsService,
    private readonly sessionsService: SessionsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  async getSummary(actor: AuthenticatedUser, now = new Date()): Promise<DashboardSummaryDto> {
    const isAdmin = this.classScope.isAdmin(actor);
    const allClasses = await this.schoolRepo.listAllClasses();
    const visibleClasses = isAdmin
      ? allClasses
      : allClasses.filter((c) => c.teacherIds.includes(actor.id));

    const deviceList = await this.devicesService.listDevices(
      actor,
      { page: 1, pageSize: 100 },
      now,
    );

    const sessions = await this.sessionsService.listSessions(actor);
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;

    const visibleDeviceIds = new Set(deviceList.items.map((d) => d.id));
    const allCommands = this.commandsService
      .listAllCommands()
      .filter((cmd) => isAdmin || visibleDeviceIds.has(cmd.deviceId));

    const pendingCommands = allCommands.filter(
      (cmd) =>
        cmd.status === COMMAND_STATUSES.PENDING ||
        cmd.status === COMMAND_STATUSES.SENT ||
        cmd.status === COMMAND_STATUSES.ACKNOWLEDGED,
    ).length;

    const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
    const failedCommandsLast24h = allCommands.filter(
      (cmd) =>
        (cmd.status === COMMAND_STATUSES.FAILED || cmd.status === COMMAND_STATUSES.TIMEOUT) &&
        new Date(cmd.updatedAt).getTime() >= twentyFourHoursAgo,
    ).length;

    return {
      totalClasses: visibleClasses.length,
      totalDevices: deviceList.totalItems,
      onlineDevices: deviceList.items.filter((d) => d.status === DEVICE_STATUSES.ONLINE).length,
      offlineDevices: deviceList.items.filter((d) => d.status === DEVICE_STATUSES.OFFLINE).length,
      activeSessions,
      pendingCommands,
      failedCommandsLast24h,
    };
  }

  async getDeviceStatusBreakdown(
    actor: AuthenticatedUser,
    now = new Date(),
  ): Promise<Record<DeviceStatus, number>> {
    const deviceList = await this.devicesService.listDevices(
      actor,
      { page: 1, pageSize: 100 },
      now,
    );

    const breakdown: Record<DeviceStatus, number> = {
      ONLINE: 0,
      OFFLINE: 0,
      UNKNOWN: 0,
      PENDING: 0,
      ERROR: 0,
    };

    for (const d of deviceList.items) {
      breakdown[d.status] = (breakdown[d.status] ?? 0) + 1;
    }

    return breakdown;
  }

  async getRecentActivity(actor: AuthenticatedUser, limit = 20): Promise<AuditLogItemDto[]> {
    return this.listAuditLogs(actor, limit);
  }

  async getAlerts(actor: AuthenticatedUser): Promise<NotificationItemDto[]> {
    return this.realtimeGateway.listNotificationsForUser(actor.id);
  }

  async listAuditLogs(actor: AuthenticatedUser, limit = 50): Promise<AuditLogItemDto[]> {
    const isAdmin = this.classScope.isAdmin(actor);
    const logs = await this.authRepo.listAuditLogs(limit * 2);

    const filtered = isAdmin ? logs : logs.filter((l) => l.actorUserId === actor.id);

    return filtered.slice(0, limit).map((l) => ({
      id: l.id,
      actorUserId: l.actorUserId,
      actorRole: (l.actorRole as AuditLogItemDto['actorRole']) ?? 'SYSTEM',
      action: l.action,
      entityType: l.targetType,
      entityId: l.targetId,
      classId: typeof l.metadata.classId === 'string' ? l.metadata.classId : null,
      metadata: { ...l.metadata },
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async getReportOverview(actor: AuthenticatedUser, now = new Date()): Promise<ReportOverviewDto> {
    this.classScope.assertAdminRole(actor, 'Xem báo cáo tổng hợp toàn trường');

    const deviceStatusBreakdown = await this.getDeviceStatusBreakdown(actor, now);

    const commandStatusBreakdown: Record<CommandStatus, number> = {
      PENDING: 0,
      SENT: 0,
      ACKNOWLEDGED: 0,
      SUCCESS: 0,
      FAILED: 0,
      TIMEOUT: 0,
      UNSUPPORTED: 0,
    };

    for (const cmd of this.commandsService.listAllCommands()) {
      commandStatusBreakdown[cmd.status] = (commandStatusBreakdown[cmd.status] ?? 0) + 1;
    }

    const sessionsByStatus: Record<ClassSessionStatus, number> = {
      SCHEDULED: 0,
      ACTIVE: 0,
      ENDED: 0,
      CANCELLED: 0,
    };

    const sessions = await this.sessionsService.listSessions(actor);
    for (const s of sessions) {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] ?? 0) + 1;
    }

    const appCounts = new Map<string, { packageName: string; name: string; count: number }>();
    for (const device of this.deviceSyncService.listSyncedDevices(now)) {
      for (const app of device.installedApps) {
        const existing = appCounts.get(app.packageName);
        if (existing) {
          existing.count += 1;
        } else {
          appCounts.set(app.packageName, {
            packageName: app.packageName,
            name: app.name,
            count: 1,
          });
        }
      }
    }

    const topInstalledApps = Array.from(appCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        packageName: item.packageName,
        name: item.name,
        installedDeviceCount: item.count,
      }));

    return {
      generatedAt: now.toISOString(),
      deviceStatusBreakdown,
      commandStatusBreakdown,
      sessionsByStatus,
      topInstalledApps,
    };
  }
}
