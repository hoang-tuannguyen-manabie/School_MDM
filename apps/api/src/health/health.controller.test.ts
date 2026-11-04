import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns structured health response with requestId and ISO timestamp', () => {
    const controller = new HealthController();
    const res = controller.getHealth();

    expect(res.data.service).toBe('@school-mdm/api');
    expect(res.data.status).toBe('ok');
    expect(res.meta.requestId).toBeTruthy();
    expect(() => new Date(res.meta.timestamp).toISOString()).not.toThrow();
  });
});
