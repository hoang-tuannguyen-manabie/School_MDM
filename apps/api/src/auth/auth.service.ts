import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedUser,
  AuthSessionSummary,
  AuthTokensResponse,
} from '@school-mdm/contracts';
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type ChangePasswordRequestInput,
  type LoginRequestInput,
} from '@school-mdm/validation';
import { AuthRepositoryPort, type StoredUserRecord } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface AuthRequestContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthSuccessBundle {
  response: AuthTokensResponse;
  rawRefreshToken: string;
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepo: AuthRepositoryPort,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async login(rawInput: LoginRequestInput, ctx: AuthRequestContext): Promise<AuthSuccessBundle> {
    const parsed = loginRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dữ liệu đăng nhập không hợp lệ');
    }

    const { email, password } = parsed.data;
    const now = new Date();
    const user = await this.authRepo.findUserByEmail(email);

    if (!user) {
      await this.authRepo.recordAuditLog({
        actorUserId: null,
        actorRole: null,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'USER',
        targetId: null,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { email, reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!user.isActive) {
      await this.authRepo.recordAuditLog({
        actorUserId: user.id,
        actorRole: user.roles[0] ?? null,
        action: 'AUTH_LOGIN_DISABLED_ACCOUNT',
        targetType: 'USER',
        targetId: user.id,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {},
      });
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.authRepo.recordAuditLog({
        actorUserId: user.id,
        actorRole: user.roles[0] ?? null,
        action: 'AUTH_LOGIN_LOCKED_ACCOUNT',
        targetType: 'USER',
        targetId: user.id,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { lockedUntil: user.lockedUntil.toISOString() },
      });
      throw new ForbiddenException('Tài khoản đang bị tạm khóa do nhập sai mật khẩu quá số lần quy định');
    }

    const passwordMatches = this.passwordService.verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      const nextFailures = user.failedLoginAttempts + 1;
      const lockedUntil =
        nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS
          ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
          : null;

      await this.authRepo.updateUserLoginFailure(user.id, nextFailures, lockedUntil);
      await this.authRepo.recordAuditLog({
        actorUserId: user.id,
        actorRole: user.roles[0] ?? null,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'USER',
        targetId: user.id,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: {
          failedAttempts: nextFailures,
          lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
        },
      });
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    await this.authRepo.updateUserLoginSuccess(user.id, now);

    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(
      now.getTime() + this.tokenService.getRefreshExpiresInSeconds() * 1000,
    );

    const sessionRecord = await this.authRepo.createRefreshToken({
      userId: user.id,
      tokenHash,
      familyId: randomUUID(),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      expiresAt,
    });

    const authenticatedUser = this.mapToAuthenticatedUser(user);
    const accessToken = this.tokenService.signAccessToken(authenticatedUser);

    await this.authRepo.recordAuditLog({
      actorUserId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'SESSION',
      targetId: sessionRecord.id,
      result: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { familyId: sessionRecord.familyId },
    });

    return {
      rawRefreshToken,
      response: {
        accessToken,
        expiresInSeconds: this.tokenService.getAccessExpiresInSeconds(),
        user: authenticatedUser,
      },
    };
  }

  async refreshSession(
    rawRefreshToken: string | null,
    ctx: AuthRequestContext,
  ): Promise<AuthSuccessBundle> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }

    const now = new Date();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const existingToken = await this.authRepo.findRefreshTokenByHash(tokenHash);

    if (!existingToken) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    // Reuse detection: if an already revoked token is presented again, revoke the entire family
    if (existingToken.revokedAt !== null) {
      await this.authRepo.revokeRefreshTokenFamily(existingToken.familyId, now);
      await this.authRepo.recordAuditLog({
        actorUserId: existingToken.userId,
        actorRole: null,
        action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        targetType: 'SESSION_FAMILY',
        targetId: existingToken.familyId,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { tokenId: existingToken.id },
      });
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi vì lý do bảo mật');
    }

    if (existingToken.expiresAt <= now) {
      await this.authRepo.revokeRefreshTokenById(existingToken.id, now);
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    const user = await this.authRepo.findUserById(existingToken.userId);
    if (!user || !user.isActive) {
      await this.authRepo.revokeRefreshTokenFamily(existingToken.familyId, now);
      throw new UnauthorizedException('Tài khoản không còn hoạt động');
    }

    const nextRawRefreshToken = this.tokenService.generateRawRefreshToken();
    const nextTokenHash = this.tokenService.hashRefreshToken(nextRawRefreshToken);
    const nextExpiresAt = new Date(
      now.getTime() + this.tokenService.getRefreshExpiresInSeconds() * 1000,
    );

    const rotatedToken = await this.authRepo.rotateRefreshToken(existingToken.id, {
      userId: user.id,
      tokenHash: nextTokenHash,
      familyId: existingToken.familyId,
      userAgent: ctx.userAgent ?? existingToken.userAgent,
      ipAddress: ctx.ipAddress ?? existingToken.ipAddress,
      expiresAt: nextExpiresAt,
    });

    const authenticatedUser = this.mapToAuthenticatedUser(user);
    const accessToken = this.tokenService.signAccessToken(authenticatedUser);

    await this.authRepo.recordAuditLog({
      actorUserId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'AUTH_TOKEN_REFRESHED',
      targetType: 'SESSION',
      targetId: rotatedToken.id,
      result: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { previousTokenId: existingToken.id },
    });

    return {
      rawRefreshToken: nextRawRefreshToken,
      response: {
        accessToken,
        expiresInSeconds: this.tokenService.getAccessExpiresInSeconds(),
        user: authenticatedUser,
      },
    };
  }

  async logout(
    rawRefreshToken: string | null,
    actorUserId: string | null,
    ctx: AuthRequestContext,
  ): Promise<void> {
    const now = new Date();
    let targetSessionId: string | null = null;
    let resolvedUserId = actorUserId;

    if (rawRefreshToken) {
      const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
      const tokenRecord = await this.authRepo.findRefreshTokenByHash(tokenHash);
      if (tokenRecord) {
        targetSessionId = tokenRecord.id;
        resolvedUserId = resolvedUserId ?? tokenRecord.userId;
        await this.authRepo.revokeRefreshTokenFamily(tokenRecord.familyId, now);
      }
    }

    await this.authRepo.recordAuditLog({
      actorUserId: resolvedUserId,
      actorRole: null,
      action: 'AUTH_LOGOUT',
      targetType: 'SESSION',
      targetId: targetSessionId,
      result: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {},
    });
  }

  async changePassword(
    userId: string,
    rawInput: ChangePasswordRequestInput,
    ctx: AuthRequestContext,
  ): Promise<void> {
    const parsed = changePasswordRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Yêu cầu đổi mật khẩu không hợp lệ',
      );
    }

    const user = await this.authRepo.findUserById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const currentMatches = this.passwordService.verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      await this.authRepo.recordAuditLog({
        actorUserId: user.id,
        actorRole: user.roles[0] ?? null,
        action: 'AUTH_CHANGE_PASSWORD_FAILED',
        targetType: 'USER',
        targetId: user.id,
        result: 'FAILURE',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: 'INVALID_CURRENT_PASSWORD' },
      });
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const now = new Date();
    const newPasswordHash = this.passwordService.hashPassword(parsed.data.newPassword);
    await this.authRepo.updateUserPassword(user.id, newPasswordHash, now);
    await this.authRepo.revokeAllUserRefreshTokens(user.id, now);

    await this.authRepo.recordAuditLog({
      actorUserId: user.id,
      actorRole: user.roles[0] ?? null,
      action: 'AUTH_CHANGE_PASSWORD_SUCCESS',
      targetType: 'USER',
      targetId: user.id,
      result: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { revokedAllSessions: true },
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.authRepo.findUserById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không hợp lệ hoặc đã bị khóa');
    }
    return this.mapToAuthenticatedUser(user);
  }

  async listActiveSessions(userId: string): Promise<AuthSessionSummary[]> {
    const records = await this.authRepo.listActiveUserRefreshTokens(userId, new Date());
    return records.map((record) => ({
      id: record.id,
      familyId: record.familyId,
      userAgent: record.userAgent,
      ipAddress: record.ipAddress,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ctx: AuthRequestContext,
  ): Promise<{ revoked: boolean }> {
    const activeSessions = await this.authRepo.listActiveUserRefreshTokens(userId, new Date());
    const target = activeSessions.find((s) => s.id === sessionId);
    if (!target) {
      throw new NotFoundException('Không tìm thấy phiên đăng nhập cần thu hồi');
    }

    await this.authRepo.revokeRefreshTokenById(sessionId, new Date());
    await this.authRepo.recordAuditLog({
      actorUserId: userId,
      actorRole: null,
      action: 'AUTH_SESSION_REVOKED',
      targetType: 'SESSION',
      targetId: sessionId,
      result: 'SUCCESS',
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {},
    });

    return { revoked: true };
  }

  private mapToAuthenticatedUser(user: StoredUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: [...user.roles],
      assignedClassIds: [...user.assignedClassIds],
    };
  }
}
