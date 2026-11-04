import { Controller, Get } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ApiResponse } from '@school-mdm/contracts';

export interface SystemHealthPayload {
  service: string;
  status: 'ok';
  mode: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ApiResponse<SystemHealthPayload> {
    return {
      data: {
        service: '@school-mdm/api',
        status: 'ok',
        mode: process.env.MDM_DEFAULT_PROVIDER ?? 'CLASSROOM_DPC',
      },
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
