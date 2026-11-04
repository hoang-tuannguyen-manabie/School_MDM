import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommandsModule } from '../commands/commands.module';
import { DevicesModule } from '../devices/devices.module';
import { MdmModule } from '../mdm/mdm.module';
import { SchoolModule } from '../school/school.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [AuthModule, SchoolModule, MdmModule, DevicesModule, CommandsModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
