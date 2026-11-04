import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  type MdmCapabilityMatrix,
  type MdmProviderType,
} from '@school-mdm/contracts';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { DeviceSyncService, type MdmSyncRunRecord } from './device-sync.service';
import { MdmCapabilityService } from './mdm-capability.service';
import { MdmProviderService, type MdmProviderConfigSummary } from './mdm-provider.service';

@Controller('mdm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MdmController {
  constructor(
    private readonly providerService: MdmProviderService,
    private readonly capabilityService: MdmCapabilityService,
    private readonly deviceSyncService: DeviceSyncService,
  ) {}

  @Get('providers')
  @Roles(ROLES.ADMIN)
  listProviders(): ApiResponse<MdmProviderConfigSummary[]> {
    return this.wrap(this.providerService.listProviders());
  }

  @Get('capabilities')
  async getCapabilities(
    @Query('providerType') providerType?: MdmProviderType,
  ): Promise<ApiResponse<MdmCapabilityMatrix>> {
    const adapter = this.providerService.getAdapter(providerType);
    const matrix = await this.capabilityService.inspectCapabilities(adapter);
    return this.wrap(matrix);
  }

  @Post('test-connection')
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @Body() body: { providerType?: MdmProviderType },
  ): Promise<
    ApiResponse<{
      providerType: MdmProviderType;
      connected: boolean;
      providerVersion: string;
      message?: string;
      capabilities: MdmCapabilityMatrix;
    }>
  > {
    const result = await this.providerService.testConnection(body.providerType);
    return this.wrap(result);
  }

  @Post('sync')
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerManualSync(
    @Body() body: { providerType?: MdmProviderType },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<MdmSyncRunRecord>> {
    const actor = this.requireUser(req);
    const run = await this.deviceSyncService.syncDevices('MANUAL', actor, body.providerType);
    return this.wrap(run);
  }

  @Get('sync-runs')
  @Roles(ROLES.ADMIN)
  listSyncRuns(): ApiResponse<MdmSyncRunRecord[]> {
    return this.wrap(this.deviceSyncService.listSyncRuns());
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
