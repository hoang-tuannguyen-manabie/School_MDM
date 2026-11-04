import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '@school-mdm/validation';
import { WorkerCapabilityGuardService } from './worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
  ],
  providers: [WorkerCapabilityGuardService],
  exports: [WorkerCapabilityGuardService],
})
export class WorkerModule {}
