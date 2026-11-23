import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';

export interface AuthorizationCodeData {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  scope?: string;
  expiresAt: number;
}

@Injectable()
export class OAuthPkceService {
  private readonly codes = new Map<string, AuthorizationCodeData>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  /**
   * Generates a cryptographically random RFC 7636 code verifier (43-128 chars)
   */
  generateCodeVerifier(length = 64): string {
    const validLength = Math.max(43, Math.min(128, length));
    return randomBytes(Math.ceil(validLength * 0.75))
      .toString('base64url')
      .slice(0, validLength);
  }

  /**
   * Computes the S256 code challenge: BASE64URL(SHA256(ASCII(code_verifier)))
   * Rejects 'plain' method to comply with OAuth 2.1 specifications.
   */
  generateCodeChallenge(verifier: string, method: 'S256' | 'plain' = 'S256'): string {
    if (method === 'plain') {
      throw new BadRequestException(
        "OAuth 2.1 RFC 7636 violation: 'plain' code_challenge_method is prohibited. 'S256' is mandatory.",
      );
    }
    return createHash('sha256').update(verifier, 'ascii').digest('base64url');
  }

  /**
   * Issues a short-lived (5-minute), single-use authorization code bound to S256 code challenge
   */
  issueAuthorizationCode(params: {
    userId: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: 'S256' | 'plain';
    scope?: string;
  }): string {
    const method = params.codeChallengeMethod ?? 'S256';
    if (method !== 'S256') {
      throw new BadRequestException("Only 'S256' code_challenge_method is accepted.");
    }
    if (!params.codeChallenge || params.codeChallenge.length < 40) {
      throw new BadRequestException('A valid S256 code_challenge is mandatory for PKCE.');
    }

    const code = `cp_auth_${randomBytes(24).toString('base64url')}`;
    const codeData: AuthorizationCodeData = {
      code,
      userId: params.userId,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scope: params.scope,
      expiresAt: Date.now() + 300000, // 5 minutes TTL
    };

    this.codes.set(code, codeData);
    this.syncToRedis(code, codeData, 300);

    return code;
  }

  /**
   * Redeems authorization code with code_verifier.
   * Single-use guarantee: the authorization code is deleted immediately.
   */
  verifyAndRedeemCode(params: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
  }): { userId: string; clientId: string; scope?: string } {
    const codeData = this.codes.get(params.code);
    if (!codeData) {
      throw new UnauthorizedException('Authorization code is invalid or has already been redeemed.');
    }

    // Enforce single-use immediately
    this.codes.delete(params.code);
    this.deleteFromRedis(params.code);

    if (Date.now() > codeData.expiresAt) {
      throw new UnauthorizedException('Authorization code has expired.');
    }

    if (codeData.clientId !== params.clientId) {
      throw new UnauthorizedException('Client ID mismatch on code redemption.');
    }

    if (codeData.redirectUri !== params.redirectUri) {
      throw new UnauthorizedException('Redirect URI mismatch on code redemption.');
    }

    // Verify S256 PKCE challenge
    const expectedChallenge = createHash('sha256')
      .update(params.codeVerifier, 'ascii')
      .digest('base64url');

    if (expectedChallenge !== codeData.codeChallenge) {
      throw new UnauthorizedException(
        'PKCE Verification Failed: Computed S256 challenge does not match stored code_challenge.',
      );
    }

    return {
      userId: codeData.userId,
      clientId: codeData.clientId,
      scope: codeData.scope,
    };
  }

  private syncToRedis(code: string, data: AuthorizationCodeData, ttlSec: number): void {
    if (this.redis) {
      try {
        const client = (this.redis as unknown as { getClient?: () => { setex?: (k: string, s: number, v: string) => Promise<unknown> } }).getClient?.();
        if (client?.setex) {
          client.setex(`oauth:code:${code}`, ttlSec, JSON.stringify(data)).catch(() => {});
        }
      } catch {
        // non-blocking
      }
    }
  }

  private deleteFromRedis(code: string): void {
    if (this.redis) {
      try {
        const client = (this.redis as unknown as { getClient?: () => { del?: (k: string) => Promise<unknown> } }).getClient?.();
        if (client?.del) {
          client.del(`oauth:code:${code}`).catch(() => {});
        }
      } catch {
        // non-blocking
      }
    }
  }
}
