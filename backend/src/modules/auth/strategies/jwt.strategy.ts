import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { VaultService } from '../../security/vault.service';

interface JwtPayload {
  sub?: unknown;
  githubId?: unknown;
  username?: unknown;
  email?: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @Optional() private vaultService?: VaultService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: any, secretOrKey?: string | Buffer) => void,
      ) => {
        // Collect candidate keys in order of precedence: current Vault key, previous (dual-key window), or env
        const validKeys = vaultService
          ? vaultService.getValidJwtVerificationKeys()
          : [
              configService.get<string>('JWT_SECRET') ||
                'dev-fallback-secret-codepulse-key-management-32b',
            ];

        // Determine which valid signing key validates the token signature
        for (const key of validKeys) {
          try {
            jwt.verify(rawJwtToken, key, { ignoreExpiration: true });
            return done(null, key);
          } catch {
            // Try next valid key in rotation window
          }
        }

        // Default to the first key if none matched so standard failure handling applies
        return done(null, validKeys[0]);
      },
    });
  }

  validate(payload: JwtPayload) {
    // This payload is the decoded JWT
    // Passport automatically attaches this return value to req.user
    if (!payload || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.sub,
      githubId: typeof payload.githubId === 'string' ? payload.githubId : null,
      username: typeof payload.username === 'string' ? payload.username : null,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  }
}
