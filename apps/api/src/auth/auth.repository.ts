import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RoleName } from '@school-mdm/contracts';

export interface StoredUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  deletedAt: Date | null;
  roles: RoleName[];
  assignedClassIds: string[];
}

export interface StoredRefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

export interface StoredAuditLogRecord {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: 'SUCCESS' | 'FAILURE';
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export abstract class AuthRepositoryPort {
  abstract findUserByEmail(email: string): Promise<StoredUserRecord | null>;
  abstract findUserById(userId: string): Promise<StoredUserRecord | null>;
  abstract updateUserLoginFailure(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  abstract updateUserLoginSuccess(userId: string, loggedInAt: Date): Promise<void>;
  abstract updateUserPassword(
    userId: string,
    newPasswordHash: string,
    changedAt: Date,
  ): Promise<void>;
  abstract createRefreshToken(
    record: Omit<StoredRefreshTokenRecord, 'id' | 'createdAt' | 'revokedAt' | 'replacedByTokenId'>,
  ): Promise<StoredRefreshTokenRecord>;
  abstract findRefreshTokenByHash(tokenHash: string): Promise<StoredRefreshTokenRecord | null>;
  abstract rotateRefreshToken(
    oldTokenId: string,
    newToken: Omit<
      StoredRefreshTokenRecord,
      'id' | 'createdAt' | 'revokedAt' | 'replacedByTokenId'
    >,
  ): Promise<StoredRefreshTokenRecord>;
  abstract revokeRefreshTokenById(tokenId: string, revokedAt: Date): Promise<void>;
  abstract revokeRefreshTokenFamily(familyId: string, revokedAt: Date): Promise<void>;
  abstract revokeAllUserRefreshTokens(userId: string, revokedAt: Date): Promise<void>;
  abstract listActiveUserRefreshTokens(
    userId: string,
    now: Date,
  ): Promise<StoredRefreshTokenRecord[]>;
  abstract recordAuditLog(
    entry: Omit<StoredAuditLogRecord, 'id' | 'createdAt'>,
  ): Promise<StoredAuditLogRecord>;
  abstract listAuditLogs(limit?: number): Promise<StoredAuditLogRecord[]>;
}

@Injectable()
export class InMemoryAuthRepository extends AuthRepositoryPort {
  private readonly users = new Map<string, StoredUserRecord>();
  private readonly refreshTokens = new Map<string, StoredRefreshTokenRecord>();
  private readonly auditLogs: StoredAuditLogRecord[] = [];

  seedUser(user: StoredUserRecord): void {
    this.users.set(user.id, {
      ...user,
      email: user.email.toLowerCase(),
    });
  }

  getAuditLogs(): readonly StoredAuditLogRecord[] {
    return this.auditLogs;
  }

  override async findUserByEmail(email: string): Promise<StoredUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized && user.deletedAt === null) {
        return { ...user };
      }
    }
    return null;
  }

  override async findUserById(userId: string): Promise<StoredUserRecord | null> {
    const user = this.users.get(userId);
    if (!user || user.deletedAt !== null) {
      return null;
    }
    return { ...user };
  }

  override async updateUserLoginFailure(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.failedLoginAttempts = failedAttempts;
      user.lockedUntil = lockedUntil;
    }
  }

  override async updateUserLoginSuccess(userId: string, loggedInAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.lastLoginAt = loggedInAt;
    }
  }

  override async updateUserPassword(
    userId: string,
    newPasswordHash: string,
    changedAt: Date,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = newPasswordHash;
      user.passwordChangedAt = changedAt;
    }
  }

  override async createRefreshToken(
    record: Omit<StoredRefreshTokenRecord, 'id' | 'createdAt' | 'revokedAt' | 'replacedByTokenId'>,
  ): Promise<StoredRefreshTokenRecord> {
    const created: StoredRefreshTokenRecord = {
      ...record,
      id: randomUUID(),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    };
    this.refreshTokens.set(created.id, created);
    return { ...created };
  }

  override async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<StoredRefreshTokenRecord | null> {
    for (const token of this.refreshTokens.values()) {
      if (token.tokenHash === tokenHash) {
        return { ...token };
      }
    }
    return null;
  }

  override async rotateRefreshToken(
    oldTokenId: string,
    newTokenInput: Omit<
      StoredRefreshTokenRecord,
      'id' | 'createdAt' | 'revokedAt' | 'replacedByTokenId'
    >,
  ): Promise<StoredRefreshTokenRecord> {
    const newToken = await this.createRefreshToken(newTokenInput);
    const oldToken = this.refreshTokens.get(oldTokenId);
    if (oldToken) {
      oldToken.revokedAt = new Date();
      oldToken.replacedByTokenId = newToken.id;
    }
    return newToken;
  }

  override async revokeRefreshTokenById(tokenId: string, revokedAt: Date): Promise<void> {
    const token = this.refreshTokens.get(tokenId);
    if (token && token.revokedAt === null) {
      token.revokedAt = revokedAt;
    }
  }

  override async revokeRefreshTokenFamily(familyId: string, revokedAt: Date): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.familyId === familyId && token.revokedAt === null) {
        token.revokedAt = revokedAt;
      }
    }
  }

  override async revokeAllUserRefreshTokens(userId: string, revokedAt: Date): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && token.revokedAt === null) {
        token.revokedAt = revokedAt;
      }
    }
  }

  override async listActiveUserRefreshTokens(
    userId: string,
    now: Date,
  ): Promise<StoredRefreshTokenRecord[]> {
    const active: StoredRefreshTokenRecord[] = [];
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && token.revokedAt === null && token.expiresAt > now) {
        active.push({ ...token });
      }
    }
    return active;
  }

  override async recordAuditLog(
    entry: Omit<StoredAuditLogRecord, 'id' | 'createdAt'>,
  ): Promise<StoredAuditLogRecord> {
    const created: StoredAuditLogRecord = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.auditLogs.push(created);
    return { ...created };
  }

  override async listAuditLogs(limit = 100): Promise<StoredAuditLogRecord[]> {
    return [...this.auditLogs]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((item) => ({ ...item, metadata: { ...item.metadata } }));
  }
}
