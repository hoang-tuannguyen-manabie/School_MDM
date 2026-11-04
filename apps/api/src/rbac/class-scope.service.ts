import { ForbiddenException, Injectable } from '@nestjs/common';
import { ROLES, type AuthenticatedUser } from '@school-mdm/contracts';

@Injectable()
export class ClassScopeService {
  isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.includes(ROLES.ADMIN);
  }

  canAccessClass(user: AuthenticatedUser, classId: string, activeAssignedClassIds: string[]): boolean {
    if (this.isAdmin(user)) {
      return true;
    }
    return activeAssignedClassIds.includes(classId);
  }

  assertCanAccessClass(
    user: AuthenticatedUser,
    classId: string,
    activeAssignedClassIds: string[],
  ): void {
    if (!this.canAccessClass(user, classId, activeAssignedClassIds)) {
      throw new ForbiddenException(
        'Giáo viên không được phép truy cập lớp học hoặc thiết bị nằm ngoài phạm vi phân công.',
      );
    }
  }

  assertAdminRole(user: AuthenticatedUser, actionDescription: string): void {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException(
        `Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện: ${actionDescription}`,
      );
    }
  }
}
