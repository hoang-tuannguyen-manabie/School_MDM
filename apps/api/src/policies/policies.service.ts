import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedUser,
  MdmProviderType,
  PolicyCapabilityKey,
  PolicySummaryDto,
  PolicyVersionDto,
} from '@school-mdm/contracts';
import {
  clonePolicySchema,
  createPolicySchema,
  policyRulesConfigSchema,
  type ClonePolicyInput,
  type CreatePolicyInput,
  type PolicyRulesConfigInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort } from '../auth/auth.repository';
import {
  MdmCapabilityService,
  type PolicyCompatibilityReport,
} from '../mdm/mdm-capability.service';
import { MdmProviderService } from '../mdm/mdm-provider.service';
import { ClassScopeService } from '../rbac/class-scope.service';

@Injectable()
export class PoliciesService {
  private readonly policiesById = new Map<string, PolicySummaryDto>();

  constructor(
    private readonly mdmProviderService: MdmProviderService,
    private readonly mdmCapabilityService: MdmCapabilityService,
    private readonly classScope: ClassScopeService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  async createPolicy(
    actor: AuthenticatedUser,
    rawInput: CreatePolicyInput,
    requestId = randomUUID(),
  ): Promise<PolicySummaryDto> {
    this.classScope.assertAdminRole(actor, 'Tạo chính sách quản lý thiết bị');

    const parsed = createPolicySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu chính sách không hợp lệ',
      );
    }

    for (const p of this.policiesById.values()) {
      if (p.code === parsed.data.code) {
        throw new ConflictException(`Mã chính sách ${parsed.data.code} đã tồn tại`);
      }
    }

    const nowIso = new Date().toISOString();
    const policyId = randomUUID();
    const v1 = this.buildVersionDto(policyId, 1, parsed.data.initialRules, nowIso);

    const policy: PolicySummaryDto = {
      id: policyId,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      currentVersionId: null,
      isActive: true,
      versions: [v1],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.policiesById.set(policy.id, policy);

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'POLICY_CREATED',
      targetType: 'POLICY',
      targetId: policy.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        code: policy.code,
        requiredCapabilities: v1.requiredCapabilities,
      },
    });

    return this.clonePolicyDto(policy);
  }

  async updateDraftPolicyVersion(
    actor: AuthenticatedUser,
    policyId: string,
    versionId: string,
    rawRules: PolicyRulesConfigInput,
    requestId = randomUUID(),
  ): Promise<PolicyVersionDto> {
    this.classScope.assertAdminRole(actor, 'Cập nhật phiên bản chính sách');

    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new NotFoundException('Không tìm thấy chính sách');
    }

    const version = policy.versions.find((v) => v.id === versionId);
    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản chính sách');
    }

    // Rule: Published policy version MUST be immutable
    if (version.status !== 'DRAFT') {
      throw new BadRequestException(
        `Phiên bản chính sách v${version.versionNumber} đã ở trạng thái ${version.status} và là bất biến (immutable). Vui lòng tạo phiên bản mới để chỉnh sửa.`,
      );
    }

    const parsed = policyRulesConfigSchema.safeParse(rawRules);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Cấu hình quy tắc chính sách không hợp lệ',
      );
    }

    const rules = parsed.data;
    version.kioskModeEnabled = rules.kioskModeEnabled;
    version.kioskPackageName = rules.kioskPackageName;
    version.appAllowlistEnabled = rules.appAllowlistEnabled;
    version.allowedPackages = [...rules.allowedPackages];
    version.urlFilteringEnabled = rules.urlFilteringEnabled;
    version.allowedDomains = [...rules.allowedDomains];
    version.lockScreenDisabled = rules.lockScreenDisabled;
    version.requiredCapabilities = this.deriveRequiredCapabilities(rules);
    policy.updatedAt = new Date().toISOString();

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'POLICY_DRAFT_VERSION_UPDATED',
      targetType: 'POLICY_VERSION',
      targetId: version.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        policyId,
        versionNumber: version.versionNumber,
        requiredCapabilities: version.requiredCapabilities,
      },
    });

    return {
      ...version,
      allowedPackages: [...version.allowedPackages],
      allowedDomains: [...version.allowedDomains],
      requiredCapabilities: [...version.requiredCapabilities],
    };
  }

  async createNewDraftVersion(
    actor: AuthenticatedUser,
    policyId: string,
    requestId = randomUUID(),
  ): Promise<PolicyVersionDto> {
    this.classScope.assertAdminRole(actor, 'Tạo phiên bản chính sách mới');

    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new NotFoundException('Không tìm thấy chính sách');
    }

    const latest = policy.versions[policy.versions.length - 1];
    if (!latest) {
      throw new NotFoundException('Chính sách chưa có phiên bản gốc');
    }

    const nextNumber = latest.versionNumber + 1;
    const nowIso = new Date().toISOString();
    const newVersion = this.buildVersionDto(
      policyId,
      nextNumber,
      {
        kioskModeEnabled: latest.kioskModeEnabled,
        kioskPackageName: latest.kioskPackageName,
        appAllowlistEnabled: latest.appAllowlistEnabled,
        allowedPackages: [...latest.allowedPackages],
        urlFilteringEnabled: latest.urlFilteringEnabled,
        allowedDomains: [...latest.allowedDomains],
        lockScreenDisabled: latest.lockScreenDisabled,
      },
      nowIso,
    );

    policy.versions.push(newVersion);
    policy.updatedAt = nowIso;

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'POLICY_NEW_VERSION_CREATED',
      targetType: 'POLICY_VERSION',
      targetId: newVersion.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: { policyId, versionNumber: nextNumber },
    });

    return {
      ...newVersion,
      allowedPackages: [...newVersion.allowedPackages],
      allowedDomains: [...newVersion.allowedDomains],
      requiredCapabilities: [...newVersion.requiredCapabilities],
    };
  }

  async publishPolicyVersion(
    actor: AuthenticatedUser,
    policyId: string,
    versionId?: string,
    providerTypeOverride?: MdmProviderType,
    requestId = randomUUID(),
  ): Promise<PolicySummaryDto> {
    this.classScope.assertAdminRole(actor, 'Xuất bản chính sách (Publish Policy)');

    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new NotFoundException('Không tìm thấy chính sách');
    }

    const targetVersion = versionId
      ? policy.versions.find((v) => v.id === versionId)
      : policy.versions[policy.versions.length - 1];

    if (!targetVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản chính sách cần xuất bản');
    }

    if (targetVersion.status === 'PUBLISHED') {
      throw new BadRequestException(
        `Phiên bản v${targetVersion.versionNumber} đã được xuất bản trước đó.`,
      );
    }

    // Verify compatibility with the target/default provider before publishing
    const compatibility = await this.checkPolicyCompatibility(
      policyId,
      targetVersion.id,
      providerTypeOverride,
    );

    if (!compatibility.compatible) {
      const reasons = compatibility.unsupportedFeatures
        .map((u) => `${u.capabilityKey}: ${u.reason}`)
        .join('; ');
      throw new BadRequestException(
        `Không thể xuất bản chính sách vì provider hiện tại (${compatibility.providerType}) không hỗ trợ các tính năng yêu cầu: ${reasons}`,
      );
    }

    const nowIso = new Date().toISOString();
    for (const v of policy.versions) {
      if (v.status === 'PUBLISHED') {
        v.status = 'ARCHIVED';
      }
    }

    targetVersion.status = 'PUBLISHED';
    targetVersion.publishedById = actor.id;
    targetVersion.publishedAt = nowIso;
    policy.currentVersionId = targetVersion.id;
    policy.updatedAt = nowIso;

    await this.authRepo.recordAuditLog({
      actorUserId: actor.id,
      actorRole: actor.roles[0] ?? 'ADMIN',
      action: 'POLICY_VERSION_PUBLISHED',
      targetType: 'POLICY_VERSION',
      targetId: targetVersion.id,
      result: 'SUCCESS',
      requestId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        policyId,
        versionNumber: targetVersion.versionNumber,
        requiredCapabilities: targetVersion.requiredCapabilities,
      },
    });

    return this.clonePolicyDto(policy);
  }

  async clonePolicy(
    actor: AuthenticatedUser,
    sourcePolicyId: string,
    rawInput: ClonePolicyInput,
    requestId = randomUUID(),
  ): Promise<PolicySummaryDto> {
    this.classScope.assertAdminRole(actor, 'Nhân bản chính sách (Clone Policy)');

    const parsed = clonePolicySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Dữ liệu nhân bản chính sách không hợp lệ',
      );
    }

    const source = this.policiesById.get(sourcePolicyId);
    if (!source) {
      throw new NotFoundException('Không tìm thấy chính sách nguồn');
    }

    const latestVersion = source.versions[source.versions.length - 1];
    if (!latestVersion) {
      throw new NotFoundException('Chính sách nguồn không có phiên bản nào');
    }

    return this.createPolicy(
      actor,
      {
        code: parsed.data.newCode,
        name: parsed.data.newName,
        description: source.description ?? undefined,
        initialRules: {
          kioskModeEnabled: latestVersion.kioskModeEnabled,
          kioskPackageName: latestVersion.kioskPackageName,
          appAllowlistEnabled: latestVersion.appAllowlistEnabled,
          allowedPackages: [...latestVersion.allowedPackages],
          urlFilteringEnabled: latestVersion.urlFilteringEnabled,
          allowedDomains: [...latestVersion.allowedDomains],
          lockScreenDisabled: latestVersion.lockScreenDisabled,
        },
      },
      requestId,
    );
  }

  async checkPolicyCompatibility(
    policyId: string,
    versionId?: string,
    providerType?: MdmProviderType,
  ): Promise<PolicyCompatibilityReport> {
    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new NotFoundException('Không tìm thấy chính sách');
    }

    const version = versionId
      ? policy.versions.find((v) => v.id === versionId)
      : (policy.versions.find((v) => v.id === policy.currentVersionId) ??
        policy.versions[policy.versions.length - 1]);

    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản chính sách');
    }

    const adapter = this.mdmProviderService.getAdapter(providerType);
    return this.mdmCapabilityService.checkPolicyCompatibility(
      adapter,
      version.requiredCapabilities,
    );
  }

  listPolicies(): PolicySummaryDto[] {
    return Array.from(this.policiesById.values()).map((p) => this.clonePolicyDto(p));
  }

  getPolicyById(policyId: string): PolicySummaryDto {
    const policy = this.policiesById.get(policyId);
    if (!policy) {
      throw new NotFoundException('Không tìm thấy chính sách');
    }
    return this.clonePolicyDto(policy);
  }

  private buildVersionDto(
    policyId: string,
    versionNumber: number,
    rules: PolicyRulesConfigInput,
    nowIso: string,
  ): PolicyVersionDto {
    return {
      id: randomUUID(),
      policyId,
      versionNumber,
      status: 'DRAFT',
      kioskModeEnabled: rules.kioskModeEnabled,
      kioskPackageName: rules.kioskPackageName,
      appAllowlistEnabled: rules.appAllowlistEnabled,
      allowedPackages: [...rules.allowedPackages],
      urlFilteringEnabled: rules.urlFilteringEnabled,
      allowedDomains: [...rules.allowedDomains],
      lockScreenDisabled: rules.lockScreenDisabled,
      requiredCapabilities: this.deriveRequiredCapabilities(rules),
      publishedById: null,
      publishedAt: null,
      createdAt: nowIso,
    };
  }

  private deriveRequiredCapabilities(rules: PolicyRulesConfigInput): PolicyCapabilityKey[] {
    const required = new Set<PolicyCapabilityKey>(['applyConfiguration']);
    if (rules.kioskModeEnabled) {
      required.add('kioskMode');
    }
    if (rules.appAllowlistEnabled) {
      required.add('appAllowlist');
    }
    if (rules.urlFilteringEnabled) {
      required.add('urlFiltering');
    }
    return Array.from(required);
  }

  private clonePolicyDto(policy: PolicySummaryDto): PolicySummaryDto {
    return {
      ...policy,
      versions: policy.versions.map((v) => ({
        ...v,
        allowedPackages: [...v.allowedPackages],
        allowedDomains: [...v.allowedDomains],
        requiredCapabilities: [...v.requiredCapabilities],
      })),
    };
  }
}
