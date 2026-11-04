import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandsModule } from '../commands/commands.module';
import { DevicesModule } from '../devices/devices.module';
import { MdmModule } from '../mdm/mdm.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchoolModule } from '../school/school.module';
import { SessionsModule } from '../sessions/sessions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    SchoolModule,
    MdmModule,
    DevicesModule,
    CommandsModule,
    SessionsModule,
    RealtimeModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
