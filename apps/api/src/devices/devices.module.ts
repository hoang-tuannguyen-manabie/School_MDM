import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { SchoolModule } from '../school/school.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AdbControlService } from './adb-control.service';

@Module({
  imports: [AuthModule, SchoolModule, MdmModule],
  controllers: [DevicesController],
  providers: [DevicesService, AdbControlService],
  exports: [DevicesService, AdbControlService],
})
export class DevicesModule {}
