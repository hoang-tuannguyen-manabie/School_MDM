import { describe, expect, it } from 'vitest';
import { dispatchDeviceCommandSchema, validateEnvironment } from './index';

describe('@school-mdm/validation', () => {
  it('validates a complete environment configuration', () => {
    const parsed = validateEnvironment({
      NODE_ENV: 'development',
      API_PORT: '4000',
      DATABASE_URL: 'postgresql://school_mdm:secret@localhost:5432/school_mdm',
      JWT_ACCESS_SECRET: 'super_secret_access_key_123456',
      JWT_REFRESH_SECRET: 'super_secret_refresh_key_123456',
    });

    expect(parsed.API_PORT).toBe(4000);
    expect(parsed.MDM_DEFAULT_PROVIDER).toBe('CLASSROOM_DPC');
  });

  it('rejects command dispatch without a valid UUID idempotencyKey', () => {
    const result = dispatchDeviceCommandSchema.safeParse({
      idempotencyKey: 'not-a-uuid',
      commandType: 'LOCK_DEVICE',
    });

    expect(result.success).toBe(false);
  });
});
