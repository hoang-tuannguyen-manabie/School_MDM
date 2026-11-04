import { Injectable } from '@nestjs/common';
import {
  COMMAND_STATUSES,
  mapCommandTypeToCapabilityKey,
  type CommandStatus,
  type CommandType,
  type MdmCapabilityMatrix,
} from '@school-mdm/contracts';

@Injectable()
export class WorkerCapabilityGuardService {
  evaluateCommandCapability(
    commandType: CommandType,
    matrix: MdmCapabilityMatrix,
  ): { allowed: boolean; status: CommandStatus; reason?: string } {
    const capabilityKey = mapCommandTypeToCapabilityKey(commandType);
    const detail = matrix.capabilities[capabilityKey];

    if (!detail.supported) {
      return {
        allowed: false,
        status: COMMAND_STATUSES.UNSUPPORTED,
        reason:
          detail.reason ??
          `Chức năng ${commandType} (${capabilityKey}) chưa được hỗ trợ bởi provider ${matrix.providerType}.`,
      };
    }

    return {
      allowed: true,
      status: COMMAND_STATUSES.PENDING,
    };
  }
}
