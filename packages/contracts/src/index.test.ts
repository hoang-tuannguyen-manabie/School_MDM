import { describe, expect, it } from 'vitest';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  DEVICE_STATUSES,
  mapCommandTypeToCapabilityKey,
} from './index';

describe('@school-mdm/contracts', () => {
  it('defines all mandatory real MDM command statuses including UNSUPPORTED', () => {
    expect(Object.values(COMMAND_STATUSES)).toEqual([
      'PENDING',
      'SENT',
      'ACKNOWLEDGED',
      'SUCCESS',
      'FAILED',
      'TIMEOUT',
      'UNSUPPORTED',
    ]);
  });

  it('defines all mandatory device statuses', () => {
    expect(Object.values(DEVICE_STATUSES)).toEqual([
      'ONLINE',
      'OFFLINE',
      'UNKNOWN',
      'PENDING',
      'ERROR',
    ]);
  });

  it('maps command types to their capability keys accurately', () => {
    expect(mapCommandTypeToCapabilityKey(COMMAND_TYPES.APPLY_KIOSK_POLICY)).toBe('kioskMode');
    expect(mapCommandTypeToCapabilityKey(COMMAND_TYPES.APPLY_ALLOWLIST)).toBe('appAllowlist');
    expect(mapCommandTypeToCapabilityKey(COMMAND_TYPES.LOCK_DEVICE)).toBe('remoteLock');
  });
});
