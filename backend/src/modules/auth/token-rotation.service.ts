import {
  Injectable,
  Logger,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  tokenType: 'Bearer';
  familyId: string;
}

export interface StoredTokenFamily {
  familyId: string;
  userId: string;
  clientId: string;
  currentActiveTokenHash: string;
  usedTokenHashes: Set<string>;
  isRevoked: boolean;
  revocationReason?: string;
  createdAt: number;
  lastRotatedAt: number;
}

@Injectable()
export class TokenRotationService {
  private readonly logger = new Logger(TokenRotationService.name);
  private readonly families = new Map<string, StoredTokenFamily>();
  private readonly tokenHashToFamily = new Map<string, string>(); // tokenHash -> familyId

  constructor(@Optional() private readonly redis?: RedisService) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Issues the initial token pair and seeds a new cryptographically bound Token Family
   */
  issueInitialTokenPair(userId: string, clientId = 'web-client'): TokenPair {
    const familyId = `fam_${randomBytes(16).toString('hex')}`;
    const rawRefreshToken = `cpr_${randomBytes(32).toString('base64url')}`;
    const tokenHash = this.hashToken(rawRefreshToken);

    const family: StoredTokenFamily = {
      familyId,
      userId,
      clientId,
      currentActiveTokenHash: tokenHash,
      usedTokenHashes: new Set<string>(),
      isRevoked: false,
      createdAt: Date.now(),
      lastRotatedAt: Date.now(),
    };

    this.families.set(familyId, family);
    this.tokenHashToFamily.set(tokenHash, familyId);
    this.syncFamilyToRedis(family);

    const accessToken = this.generateMockJwt(userId, familyId);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresInSec: 900, // 15 minutes
      tokenType: 'Bearer',
      familyId,
    };
  }

  /**
   * Rotates a refresh token with automatic reuse detection.
   * If an old/used token is presented, the ENTIRE token family is immediately revoked.
   */
  rotateRefreshToken(rawRefreshToken: string): TokenPair {
    const presentedHash = this.hashToken(rawRefreshToken);
    const familyId = this.tokenHashToFamily.get(presentedHash);

    if (!familyId) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const family = this.families.get(familyId);
    if (!family || family.isRevoked) {
      throw new UnauthorizedException(
        `Token family is revoked: ${family?.revocationReason || 'Session expired'}`,
      );
    }

    // REPLAY ATTACK DETECTION:
    // If the token presented has already been used in this family, an adversary is attempting token replay!
    if (family.usedTokenHashes.has(presentedHash)) {
      this.logger.error(
        `🚨 SECURITY ALERT: Refresh token reuse detected for User ${family.userId} in Family ${familyId}! Immediate revocation triggered.`,
      );
      this.revokeTokenFamily(
        familyId,
        'SECURITY_ALERT_REFRESH_TOKEN_REUSE_DETECTED: Stolen token replay attempt',
      );
      throw new UnauthorizedException(
        'Refresh token reuse detected! All active sessions for this token family have been permanently revoked.',
      );
    }

    // Active token validation
    if (family.currentActiveTokenHash !== presentedHash) {
      this.revokeTokenFamily(familyId, 'SECURITY_ALERT: Unknown token hash presented');
      throw new UnauthorizedException('Refresh token does not match active family token.');
    }

    // Mark current active token as USED
    family.usedTokenHashes.add(presentedHash);

    // Issue brand-new single-use Refresh Token
    const nextRawRefreshToken = `cpr_${randomBytes(32).toString('base64url')}`;
    const nextTokenHash = this.hashToken(nextRawRefreshToken);

    family.currentActiveTokenHash = nextTokenHash;
    family.lastRotatedAt = Date.now();
    this.tokenHashToFamily.set(nextTokenHash, familyId);
    this.syncFamilyToRedis(family);

    const nextAccessToken = this.generateMockJwt(family.userId, familyId);

    return {
      accessToken: nextAccessToken,
      refreshToken: nextRawRefreshToken,
      expiresInSec: 900,
      tokenType: 'Bearer',
      familyId,
    };
  }

  /**
   * Immediately revokes all sessions belonging to the token family
   */
  revokeTokenFamily(familyId: string, reason = 'User Logout'): void {
    const family = this.families.get(familyId);
    if (family) {
      family.isRevoked = true;
      family.revocationReason = reason;
      this.syncFamilyToRedis(family);
    }
  }

  isTokenFamilyActive(familyId: string): boolean {
    const family = this.families.get(familyId);
    return !!family && !family.isRevoked;
  }

  private generateMockJwt(userId: string, familyId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        familyId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    ).toString('base64url');
    const sig = createHash('sha256').update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  private syncFamilyToRedis(family: StoredTokenFamily): void {
    if (this.redis) {
      try {
        const client = (this.redis as unknown as { getClient?: () => { setex?: (k: string, s: number, v: string) => Promise<unknown> } }).getClient?.();
        if (client?.setex) {
          const serialized = {
            ...family,
            usedTokenHashes: Array.from(family.usedTokenHashes),
          };
          client.setex(`oauth:family:${family.familyId}`, 604800, JSON.stringify(serialized)).catch(() => {});
        }
      } catch {
        // non-blocking
      }
    }
  }
}
