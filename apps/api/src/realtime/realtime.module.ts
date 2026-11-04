import { Module } from '@nestjs/common';
import { SchoolModule } from '../school/school.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [SchoolModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
