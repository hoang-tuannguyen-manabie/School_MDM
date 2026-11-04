import { describe, expect, it } from 'vitest';
import { COMMAND_STATUSES, DEVICE_STATUSES } from '@school-mdm/contracts';
import { cn, getCommandStatusBadgeTone, getDeviceStatusBadgeTone } from './index';

describe('@school-mdm/ui', () => {
  it('merges tailwind class names cleanly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('returns distinct badge tones for device and command statuses', () => {
    expect(getDeviceStatusBadgeTone(DEVICE_STATUSES.ONLINE).label).toContain('Online');
    expect(getCommandStatusBadgeTone(COMMAND_STATUSES.UNSUPPORTED).label).toContain('Unsupported');
  });
});
