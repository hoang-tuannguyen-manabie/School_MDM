import { validateEnvironment, type ValidatedEnv } from '@school-mdm/validation';

export function validateApiEnvironment(config: Record<string, unknown>): ValidatedEnv {
  return validateEnvironment(config);
}
