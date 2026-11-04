import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
  type MdmProviderType,
  type PolicySummaryDto,
  type PolicyVersionDto,
} from '@school-mdm/contracts';
import type {
  ClonePolicyInput,
  CreatePolicyInput,
  PolicyRulesConfigInput,
} from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import type { PolicyCompatibilityReport } from '../mdm/mdm-capability.service';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { PoliciesService } from './policies.service';

@Controller('policies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  listPolicies(): ApiResponse<PolicySummaryDto[]> {
    return this.wrap(this.policiesService.listPolicies());
  }

  @Post()
  @Roles(ROLES.ADMIN)
  async createPolicy(
    @Body() body: CreatePolicyInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PolicySummaryDto>> {
    const actor = this.requireUser(req);
    const created = await this.policiesService.createPolicy(actor, body);
    return this.wrap(created);
  }

  @Get(':id')
  getPolicyDetail(@Param('id') policyId: string): ApiResponse<PolicySummaryDto> {
    return this.wrap(this.policiesService.getPolicyById(policyId));
  }

  @Post(':id/versions')
  @Roles(ROLES.ADMIN)
  async createNewVersion(
    @Param('id') policyId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PolicyVersionDto>> {
    const actor = this.requireUser(req);
    const version = await this.policiesService.createNewDraftVersion(actor, policyId);
    return this.wrap(version);
  }

  @Patch(':id/versions/:versionId')
  @Roles(ROLES.ADMIN)
  async updateDraftVersion(
    @Param('id') policyId: string,
    @Param('versionId') versionId: string,
    @Body() body: PolicyRulesConfigInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PolicyVersionDto>> {
    const actor = this.requireUser(req);
    const updated = await this.policiesService.updateDraftPolicyVersion(
      actor,
      policyId,
      versionId,
      body,
    );
    return this.wrap(updated);
  }

  @Post(':id/publish')
  @Roles(ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publishPolicy(
    @Param('id') policyId: string,
    @Body() body: { versionId?: string; providerType?: MdmProviderType },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PolicySummaryDto>> {
    const actor = this.requireUser(req);
    const published = await this.policiesService.publishPolicyVersion(
      actor,
      policyId,
      body.versionId,
      body.providerType,
    );
    return this.wrap(published);
  }

  @Post(':id/clone')
  @Roles(ROLES.ADMIN)
  async clonePolicy(
    @Param('id') policyId: string,
    @Body() body: ClonePolicyInput,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<PolicySummaryDto>> {
    const actor = this.requireUser(req);
    const cloned = await this.policiesService.clonePolicy(actor, policyId, body);
    return this.wrap(cloned);
  }

  @Get(':id/compatibility')
  async checkCompatibility(
    @Param('id') policyId: string,
    @Query('versionId') versionId?: string,
    @Query('providerType') providerType?: MdmProviderType,
  ): Promise<ApiResponse<PolicyCompatibilityReport>> {
    const report = await this.policiesService.checkPolicyCompatibility(
      policyId,
      versionId,
      providerType,
    );
    return this.wrap(report);
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
