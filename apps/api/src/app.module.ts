import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { CommandsModule } from './commands/commands.module';
import { validateApiEnvironment } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { DevicesModule } from './devices/devices.module';
import { HealthController } from './health/health.controller';
import { MdmModule } from './mdm/mdm.module';
import { PoliciesModule } from './policies/policies.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SchoolModule } from './school/school.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../.env', '.env'],
      validate: validateApiEnvironment,
    }),
    AuthModule,
    SchoolModule,
    MdmModule,
    DevicesModule,
    CommandsModule,
    ApplicationsModule,
    PoliciesModule,
    RealtimeModule,
    SessionsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
