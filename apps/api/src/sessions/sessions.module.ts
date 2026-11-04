import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandsModule } from '../commands/commands.module';
import { DevicesModule } from '../devices/devices.module';
import { PoliciesModule } from '../policies/policies.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchoolModule } from '../school/school.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    AuthModule,
    SchoolModule,
    DevicesModule,
    PoliciesModule,
    CommandsModule,
    RealtimeModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
