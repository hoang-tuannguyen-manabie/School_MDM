import { describe, expect, it } from 'vitest';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  MDM_PROVIDER_TYPES,
  type MdmCapabilityMatrix,
} from '@school-mdm/contracts';
import { WorkerCapabilityGuardService } from './worker.service';

describe('WorkerCapabilityGuardService', () => {
  const mockHeadwindCommunityMatrix: MdmCapabilityMatrix = {
    providerType: MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY,
    providerVersion: 'community-unverified',
    verifiedAt: new Date().toISOString(),
    capabilities: {
      deviceInventory: { supported: true },
      appCatalog: { supported: true },
      installApplication: { supported: true },
      removeApplication: { supported: true },
      applyConfiguration: { supported: true },
      kioskMode: {
        supported: false,
        reason: 'Headwind Community không hỗ trợ khóa Kiosk đầy đủ không cần add-on Enterprise.',
      },
      appAllowlist: {
        supported: false,
        reason: 'Headwind Community không hỗ trợ giới hạn ứng dụng theo allowlist.',
      },
      remoteLock: {
        supported: false,
        reason: 'Headwind Community không hỗ trợ khóa màn hình tức thời.',
      },
      remoteReboot: { supported: false },
      urlFiltering: { supported: false },
    },
  };

  it('marks unsupported commands as UNSUPPORTED and never fakes success', () => {
    const service = new WorkerCapabilityGuardService();
    const evaluation = service.evaluateCommandCapability(
      COMMAND_TYPES.APPLY_KIOSK_POLICY,
      mockHeadwindCommunityMatrix,
    );

    expect(evaluation.allowed).toBe(false);
    expect(evaluation.status).toBe(COMMAND_STATUSES.UNSUPPORTED);
    expect(evaluation.reason).toContain('Headwind Community');
  });
});
