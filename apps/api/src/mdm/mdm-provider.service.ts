import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MDM_PROVIDER_TYPES,
  type MdmAdapter,
  type MdmCapabilityMatrix,
  type MdmProviderType,
} from '@school-mdm/contracts';
import { ClassroomDpcAdapter } from './adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from './adapters/headwind.adapter';

export interface MdmProviderConfigSummary {
  id: string;
  code: string;
  name: string;
  providerType: MdmProviderType;
  baseUrl: string | null;
  providerVersion: string;
  isActive: boolean;
  isDefault: boolean;
  lastVerifiedAt: string | null;
}

@Injectable()
export class MdmProviderService {
  private readonly providers = new Map<MdmProviderType, MdmProviderConfigSummary>();
  private defaultProviderType: MdmProviderType;

  constructor(
    private readonly classroomDpcAdapter: ClassroomDpcAdapter,
    private readonly headwindAdapter: HeadwindAdapter,
  ) {
    this.defaultProviderType =
      process.env.MDM_DEFAULT_PROVIDER === MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY
        ? MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY
        : MDM_PROVIDER_TYPES.CLASSROOM_DPC;

    this.providers.set(MDM_PROVIDER_TYPES.CLASSROOM_DPC, {
      id: randomUUID(),
      code: 'classroom-dpc-local',
      name: 'Classroom DPC Gateway (0 đồng - Điều khiển trực tiếp qua LAN)',
      providerType: MDM_PROVIDER_TYPES.CLASSROOM_DPC,
      baseUrl: process.env.PUBLIC_LAN_URL ?? 'https://mdm.school.local',
      providerVersion: 'classroom-dpc-1.0.0',
      isActive: true,
      isDefault: this.defaultProviderType === MDM_PROVIDER_TYPES.CLASSROOM_DPC,
      lastVerifiedAt: null,
    });

    this.providers.set(MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY, {
      id: randomUUID(),
      code: 'headwind-community-local',
      name: 'Headwind MDM Community',
      providerType: MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY,
      baseUrl: process.env.HEADWIND_BASE_URL ?? 'http://localhost:18080',
      providerVersion: 'community-baseline',
      isActive: true,
      isDefault: this.defaultProviderType === MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY,
      lastVerifiedAt: null,
    });
  }

  getAdapter(providerType?: MdmProviderType): MdmAdapter {
    const target = providerType ?? this.defaultProviderType;
    switch (target) {
      case MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY:
        return this.headwindAdapter;
      case MDM_PROVIDER_TYPES.CLASSROOM_DPC:
      default:
        return this.classroomDpcAdapter;
    }
  }

  getDefaultProviderConfig(): MdmProviderConfigSummary {
    const config = this.providers.get(this.defaultProviderType);
    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình MDM Provider mặc định');
    }
    return { ...config };
  }

  getProviderConfig(providerType: MdmProviderType): MdmProviderConfigSummary {
    const config = this.providers.get(providerType);
    if (!config) {
      throw new NotFoundException(`Không tìm thấy cấu hình cho provider ${providerType}`);
    }
    return { ...config };
  }

  listProviders(): MdmProviderConfigSummary[] {
    return Array.from(this.providers.values()).map((p) => ({ ...p }));
  }

  setDefaultProvider(providerType: MdmProviderType): MdmProviderConfigSummary {
    if (!this.providers.has(providerType)) {
      throw new NotFoundException(`Provider ${providerType} không tồn tại`);
    }
    this.defaultProviderType = providerType;
    for (const [key, item] of this.providers.entries()) {
      item.isDefault = key === providerType;
    }
    return this.getDefaultProviderConfig();
  }

  async testConnection(providerType?: MdmProviderType): Promise<{
    providerType: MdmProviderType;
    connected: boolean;
    providerVersion: string;
    message?: string;
    capabilities: MdmCapabilityMatrix;
  }> {
    const targetType = providerType ?? this.defaultProviderType;
    const adapter = this.getAdapter(targetType);
    const connection = await adapter.connect();
    const capabilities = await adapter.getCapabilities();

    const record = this.providers.get(targetType);
    if (record) {
      record.providerVersion = connection.providerVersion;
      record.lastVerifiedAt = new Date().toISOString();
    }

    return {
      providerType: targetType,
      connected: connection.connected,
      providerVersion: connection.providerVersion,
      message: connection.message,
      capabilities,
    };
  }
}
