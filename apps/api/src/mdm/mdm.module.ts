import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SchoolModule } from '../school/school.module';
import { ClassroomDpcAdapter } from './adapters/classroom-dpc.adapter';
import { HeadwindAdapter } from './adapters/headwind.adapter';
import { DeviceSyncService } from './device-sync.service';
import { MdmCapabilityService } from './mdm-capability.service';
import { MdmProviderService } from './mdm-provider.service';
import { MdmController } from './mdm.controller';

@Module({
  imports: [AuthModule, SchoolModule],
  controllers: [MdmController],
  providers: [
    ClassroomDpcAdapter,
    HeadwindAdapter,
    MdmCapabilityService,
    MdmProviderService,
    DeviceSyncService,
  ],
  exports: [
    ClassroomDpcAdapter,
    HeadwindAdapter,
    MdmCapabilityService,
    MdmProviderService,
    DeviceSyncService,
  ],
})
export class MdmModule {}
