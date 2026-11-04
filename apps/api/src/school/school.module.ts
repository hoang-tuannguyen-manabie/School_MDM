import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassScopeService } from '../rbac/class-scope.service';
import { RolesGuard } from '../rbac/roles.guard';
import { SchoolController } from './school.controller';
import { InMemorySchoolRepository, SchoolRepositoryPort } from './school.repository';
import { SchoolService } from './school.service';

@Module({
  imports: [AuthModule],
  controllers: [SchoolController],
  providers: [
    ClassScopeService,
    RolesGuard,
    SchoolService,
    InMemorySchoolRepository,
    {
      provide: SchoolRepositoryPort,
      useExisting: InMemorySchoolRepository,
    },
  ],
  exports: [SchoolService, ClassScopeService, RolesGuard, SchoolRepositoryPort],
})
export class SchoolModule {}
