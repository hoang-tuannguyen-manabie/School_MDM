import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type {
  ApiResponse,
  AuthenticatedUser,
  AuthSessionSummary,
  AuthTokensResponse,
} from '@school-mdm/contracts';
import type { ChangePasswordRequestInput, LoginRequestInput } from '@school-mdm/validation';
import { JwtAuthGuard, type AuthenticatedRequest } from './auth.guard';
import { AuthService, type AuthRequestContext } from './auth.service';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestInput,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthTokensResponse>> {
    const ctx = this.extractContext(req);
    const result = await this.authService.login(body, ctx);

    res.setHeader(
      'Set-Cookie',
      this.tokenService.buildRefreshCookieHeader(result.rawRefreshToken, {
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
        domain: process.env.COOKIE_DOMAIN,
        maxAgeSeconds: this.tokenService.getRefreshExpiresInSeconds(),
      }),
    );

    return {
      data: result.response,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthTokensResponse>> {
    const ctx = this.extractContext(req);
    const rawRefreshToken = this.tokenService.extractRefreshTokenFromCookieHeader(
      req.headers.cookie,
    );
    const result = await this.authService.refreshSession(rawRefreshToken, ctx);

    res.setHeader(
      'Set-Cookie',
      this.tokenService.buildRefreshCookieHeader(result.rawRefreshToken, {
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
        domain: process.env.COOKIE_DOMAIN,
        maxAgeSeconds: this.tokenService.getRefreshExpiresInSeconds(),
      }),
    );

    return {
      data: result.response,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ loggedOut: true }>> {
    const ctx = this.extractContext(req);
    const rawRefreshToken = this.tokenService.extractRefreshTokenFromCookieHeader(
      req.headers.cookie,
    );

    await this.authService.logout(rawRefreshToken, req.user?.id ?? null, ctx);

    res.setHeader(
      'Set-Cookie',
      this.tokenService.buildClearRefreshCookieHeader({
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
        domain: process.env.COOKIE_DOMAIN,
      }),
    );

    return {
      data: { loggedOut: true },
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() body: ChangePasswordRequestInput,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ passwordChanged: true }>> {
    const ctx = this.extractContext(req);
    const userId = this.requireUserId(req);

    await this.authService.changePassword(userId, body, ctx);

    res.setHeader(
      'Set-Cookie',
      this.tokenService.buildClearRefreshCookieHeader({
        secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
        domain: process.env.COOKIE_DOMAIN,
      }),
    );

    return {
      data: { passwordChanged: true },
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthenticatedRequest): Promise<ApiResponse<AuthenticatedUser>> {
    const ctx = this.extractContext(req);
    const userId = this.requireUserId(req);
    const profile = await this.authService.getProfile(userId);

    return {
      data: profile,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<AuthSessionSummary[]>> {
    const ctx = this.extractContext(req);
    const userId = this.requireUserId(req);
    const sessions = await this.authService.listActiveSessions(userId);

    return {
      data: sessions,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<{ revoked: boolean }>> {
    const ctx = this.extractContext(req);
    const userId = this.requireUserId(req);
    const result = await this.authService.revokeSession(userId, sessionId, ctx);

    return {
      data: result,
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new UnauthorizedException('Chưa xác thực người dùng');
    }
    return req.user.id;
  }

  private extractContext(req: AuthenticatedRequest): AuthRequestContext {
    const headerRequestId = req.headers['x-request-id'];
    const requestId =
      typeof headerRequestId === 'string' && headerRequestId.trim().length > 0
        ? headerRequestId.trim()
        : randomUUID();

    return {
      requestId,
      ipAddress: req.ip ?? null,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    };
  }
}
