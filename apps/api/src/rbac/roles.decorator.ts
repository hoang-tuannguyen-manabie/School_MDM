import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '@school-mdm/contracts';

export const ROLES_METADATA_KEY = 'school_mdm_required_roles';

export const Roles = (...roles: RoleName[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
