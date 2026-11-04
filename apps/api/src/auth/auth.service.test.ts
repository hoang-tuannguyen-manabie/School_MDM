import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROLES } from '@school-mdm/contracts';
import { InMemoryAuthRepository } from './auth.repository';
import { AuthService, type AuthRequestContext } from './auth.service';
import { PasswordService } from './password.service';
import { REFRESH_TOKEN_COOKIE_NAME, TokenService } from './token.service';

describe('AuthService & TokenService (Phase 2)', () => {
  let repo: InMemoryAuthRepository;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let authService: AuthService;
  let teacherUserId: string;

  const defaultCtx: AuthRequestContext = {
    requestId: randomUUID(),
    ipAddress: '192.168.1.50',
    userAgent: 'Mozilla/5.0 SchoolTabletTeacher',
  };

  beforeEach(() => {
    repo = new InMemoryAuthRepository();
    passwordService = new PasswordService();
    tokenService = new TokenService();
    authService = new AuthService(repo, passwordService, tokenService);

    teacherUserId = randomUUID();
    repo.seedUser({
      id: teacherUserId,
      email: 'teacher.lan@school.local',
      passwordHash: passwordService.hashPassword('CorrectHorseBattery99!'),
      fullName: 'Cô Nguyễn Thị Lan',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      passwordChangedAt: null,
      deletedAt: null,
      roles: [ROLES.TEACHER],
      assignedClassIds: ['class-6a1'],
    });
  });

  it('logs in valid user, returns verified JWT access token, and builds HttpOnly Secure SameSite cookie', async () => {
    const bundle = await authService.login(
      {
        email: 'TEACHER.LAN@school.local',
        password: 'CorrectHorseBattery99!',
      },
      defaultCtx,
    );

    expect(bundle.response.user.email).toBe('teacher.lan@school.local');
    expect(bundle.response.user.roles).toEqual(['TEACHER']);
    expect(bundle.rawRefreshToken.length).toBeGreaterThan(32);

    const claims = tokenService.verifyAccessToken(bundle.response.accessToken);
    expect(claims.sub).toBe(teacherUserId);
    expect(claims.assignedClassIds).toEqual(['class-6a1']);

    const cookieHeader = tokenService.buildRefreshCookieHeader(bundle.rawRefreshToken, {
      secure: true,
      sameSite: 'strict',
      domain: 'mdm.school.local',
      maxAgeSeconds: tokenService.getRefreshExpiresInSeconds(),
    });

    expect(cookieHeader).toContain(`${REFRESH_TOKEN_COOKIE_NAME}=`);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('Secure');
    expect(cookieHeader).toContain('SameSite=Strict');
  });

  it('locks account after 5 consecutive failed password attempts and records audit logs', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        authService.login(
          { email: 'teacher.lan@school.local', password: 'WrongPassword123!' },
          defaultCtx,
        ),
      ).rejects.toThrow(UnauthorizedException);
    }

    // 6th attempt even with right password must be rejected with ForbiddenException while locked
    await expect(
      authService.login(
        { email: 'teacher.lan@school.local', password: 'CorrectHorseBattery99!' },
        defaultCtx,
      ),
    ).rejects.toThrow(ForbiddenException);

    const logs = repo.getAuditLogs();
    expect(logs.some((l) => l.action === 'AUTH_LOGIN_LOCKED_ACCOUNT')).toBe(true);
  });

  it('rotates refresh token on refresh and revokes entire session family if old token is reused', async () => {
    const initial = await authService.login(
      { email: 'teacher.lan@school.local', password: 'CorrectHorseBattery99!' },
      defaultCtx,
    );

    const rotated = await authService.refreshSession(initial.rawRefreshToken, defaultCtx);
    expect(rotated.rawRefreshToken).not.toBe(initial.rawRefreshToken);

    // Reusing initial token triggers reuse detection and revokes the newly rotated token too
    await expect(
      authService.refreshSession(initial.rawRefreshToken, defaultCtx),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      authService.refreshSession(rotated.rawRefreshToken, defaultCtx),
    ).rejects.toThrow(UnauthorizedException);

    const logs = repo.getAuditLogs();
    expect(logs.some((l) => l.action === 'AUTH_REFRESH_TOKEN_REUSE_DETECTED')).toBe(true);
  });

  it('changes password and revokes all active refresh token sessions', async () => {
    const loginBundle = await authService.login(
      { email: 'teacher.lan@school.local', password: 'CorrectHorseBattery99!' },
      defaultCtx,
    );

    const activeBefore = await authService.listActiveSessions(teacherUserId);
    expect(activeBefore).toHaveLength(1);

    await authService.changePassword(
      teacherUserId,
      {
        currentPassword: 'CorrectHorseBattery99!',
        newPassword: 'NewClassroomPassword2026!',
      },
      defaultCtx,
    );

    const activeAfter = await authService.listActiveSessions(teacherUserId);
    expect(activeAfter).toHaveLength(0);

    // Old refresh token is now revoked
    await expect(
      authService.refreshSession(loginBundle.rawRefreshToken, defaultCtx),
    ).rejects.toThrow(UnauthorizedException);

    // Can login with new password
    const relogin = await authService.login(
      { email: 'teacher.lan@school.local', password: 'NewClassroomPassword2026!' },
      defaultCtx,
    );
    expect(relogin.response.user.id).toBe(teacherUserId);
  });
});
