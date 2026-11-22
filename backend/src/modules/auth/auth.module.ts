import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SyncModule } from '../sync/sync.module';
import { TokenBlacklistService } from './token-blacklist.service';
import { AttestationValidatorService } from './attestation-validator.service';
import { PasskeyService } from './passkey.service';
import { PasskeyController } from './passkey.controller';
import { SamlSsoService } from './saml-sso.service';
import { Fido2AttestationService } from './fido2-attestation.service';
import { TwoFactorService } from './two-factor.service';

import { CryptoModule } from '../crypto/crypto.module';
import { PostQuantumJwtService } from './jwt.service';

import { KeysController } from './keys.controller';
import { PreKeyService } from './prekey.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { BruteForceService } from './brute-force.service';
import { BruteForceGuard } from './guards/brute-force.guard';



@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'FATAL: JWT_SECRET environment variable is required to start the application.',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRES_IN', '15m'),
          },
        };
      },
    }),
    SyncModule,
    CryptoModule,
  ],
  controllers: [
    AuthController,
    PasskeyController,
    KeysController,
    ApiKeyController,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    AttestationValidatorService,
    PasskeyService,
    SamlSsoService,
    Fido2AttestationService,
    TwoFactorService,
    PostQuantumJwtService,
    PreKeyService,
    ApiKeyService,
    ApiKeyGuard,
    BruteForceService,
    BruteForceGuard,
  ],
  exports: [
    AuthService,
    TwoFactorService,
    JwtModule,
    TokenBlacklistService,
    AttestationValidatorService,
    PasskeyService,
    SamlSsoService,
    PostQuantumJwtService,
    PreKeyService,
    ApiKeyService,
    ApiKeyGuard,
    BruteForceService,
    BruteForceGuard,
  ],
})
export class AuthModule {}
