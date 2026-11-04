import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './auth.guard';
import { AuthRepositoryPort, InMemoryAuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    AuthService,
    JwtAuthGuard,
    InMemoryAuthRepository,
    {
      provide: AuthRepositoryPort,
      useExisting: InMemoryAuthRepository,
    },
  ],
  exports: [AuthService, TokenService, PasswordService, JwtAuthGuard, AuthRepositoryPort],
})
export class AuthModule {}
