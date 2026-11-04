import { Injectable } from '@nestjs/common';
import {
  COMMAND_STATUSES,
  mapCommandTypeToCapabilityKey,
  type CommandStatus,
  type CommandType,
  type MdmAdapter,
  type MdmCapabilityMatrix,
} from '@school-mdm/contracts';

export interface CapabilityCheckResult {
  supported: boolean;
  status: CommandStatus;
  capabilityKey: keyof MdmCapabilityMatrix['capabilities'];
  reason?: string;
}

export interface PolicyCompatibilityReport {
  compatible: boolean;
  providerType: MdmCapabilityMatrix['providerType'];
  providerVersion: string;
  unsupportedFeatures: Array<{
    capabilityKey: keyof MdmCapabilityMatrix['capabilities'];
    reason: string;
  }>;
}

@Injectable()
export class MdmCapabilityService {
  async inspectCapabilities(adapter: MdmAdapter): Promise<MdmCapabilityMatrix> {
    return adapter.getCapabilities();
  }

  async checkCommandSupport(
    adapter: MdmAdapter,
    commandType: CommandType,
  ): Promise<CapabilityCheckResult> {
    const matrix = await adapter.getCapabilities();
    const capabilityKey = mapCommandTypeToCapabilityKey(commandType);
    const detail = matrix.capabilities[capabilityKey];

    if (!detail.supported) {
      return {
        supported: false,
        status: COMMAND_STATUSES.UNSUPPORTED,
        capabilityKey,
        reason:
          detail.reason ??
          `Thao tác ${commandType} (${capabilityKey}) chưa được hỗ trợ bởi provider ${matrix.providerType}.`,
      };
    }

    return {
      supported: true,
      status: COMMAND_STATUSES.PENDING,
      capabilityKey,
      reason: detail.reason,
    };
  }

  async checkPolicyCompatibility(
    adapter: MdmAdapter,
    requiredCapabilities: Array<keyof MdmCapabilityMatrix['capabilities']>,
  ): Promise<PolicyCompatibilityReport> {
    const matrix = await adapter.getCapabilities();
    const unsupportedFeatures: Array<{
      capabilityKey: keyof MdmCapabilityMatrix['capabilities'];
      reason: string;
    }> = [];

    for (const key of requiredCapabilities) {
      const cap = matrix.capabilities[key];
      if (!cap.supported) {
        unsupportedFeatures.push({
          capabilityKey: key,
          reason:
            cap.reason ??
            `Tính năng ${key} không được hỗ trợ bởi provider ${matrix.providerType} (${matrix.providerVersion}).`,
        });
      }
    }

    return {
      compatible: unsupportedFeatures.length === 0,
      providerType: matrix.providerType,
      providerVersion: matrix.providerVersion,
      unsupportedFeatures,
    };
  }
}
