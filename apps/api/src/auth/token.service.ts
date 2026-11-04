import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RoleName } from '@school-mdm/contracts';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  fullName: string;
  roles: RoleName[];
  assignedClassIds: string[];
  iat: number;
  exp: number;
}

export interface RefreshCookieConfig {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string;
  maxAgeSeconds: number;
}

export const REFRESH_TOKEN_COOKIE_NAME = 'school_mdm_rt';

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(padded, 'base64').toString('utf8');
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessExpiresInSeconds: number;
  private readonly refreshExpiresInSeconds: number;

  constructor() {
    this.accessSecret =
      process.env.JWT_ACCESS_SECRET ?? 'dev_only_access_secret_key_change_in_prod_12345';
    this.accessExpiresInSeconds = 15 * 60; // 15 minutes
    this.refreshExpiresInSeconds = 7 * 24 * 60 * 60; // 7 days
  }

  getAccessExpiresInSeconds(): number {
    return this.accessExpiresInSeconds;
  }

  getRefreshExpiresInSeconds(): number {
    return this.refreshExpiresInSeconds;
  }

  signAccessToken(user: {
    id: string;
    email: string;
    fullName: string;
    roles: RoleName[];
    assignedClassIds: string[];
  }): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      assignedClassIds: user.assignedClassIds,
      iat: nowSeconds,
      exp: nowSeconds + this.accessExpiresInSeconds,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac('sha256', this.accessSecret).update(signingInput).digest();

    return `${signingInput}.${base64UrlEncode(signature)}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Access token không hợp lệ');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Access token bị thiếu thành phần');
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = base64UrlEncode(
      createHmac('sha256', this.accessSecret).update(signingInput).digest(),
    );

    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(encodedSignature);
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new UnauthorizedException('Chữ ký access token không hợp lệ');
    }

    const claims = JSON.parse(base64UrlDecode(encodedPayload)) as AccessTokenClaims;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (claims.exp <= nowSeconds) {
      throw new UnauthorizedException('Access token đã hết hạn');
    }

    return claims;
  }

  generateRawRefreshToken(): string {
    return base64UrlEncode(randomBytes(48));
  }

  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  buildRefreshCookieHeader(rawToken: string, config: RefreshCookieConfig): string {
    const directives = [
      `${REFRESH_TOKEN_COOKIE_NAME}=${rawToken}`,
      'HttpOnly',
      'Path=/api/v1/auth',
      `Max-Age=${config.maxAgeSeconds}`,
      `SameSite=${this.formatSameSite(config.sameSite)}`,
    ];

    if (config.secure) {
      directives.push('Secure');
    }
    if (config.domain && config.domain !== 'localhost') {
      directives.push(`Domain=${config.domain}`);
    }

    return directives.join('; ');
  }

  buildClearRefreshCookieHeader(config: Omit<RefreshCookieConfig, 'maxAgeSeconds'>): string {
    return this.buildRefreshCookieHeader('', {
      ...config,
      maxAgeSeconds: 0,
    });
  }

  extractRefreshTokenFromCookieHeader(cookieHeader?: string): string | null {
    if (!cookieHeader) {
      return null;
    }

    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const [rawKey, ...rawValParts] = pair.trim().split('=');
      if (rawKey === REFRESH_TOKEN_COOKIE_NAME) {
        const value = rawValParts.join('=').trim();
        return value.length > 0 ? value : null;
      }
    }

    return null;
  }

  private formatSameSite(sameSite: 'lax' | 'strict' | 'none'): string {
    switch (sameSite) {
      case 'strict':
        return 'Strict';
      case 'none':
        return 'None';
      case 'lax':
      default:
        return 'Lax';
    }
  }
}
