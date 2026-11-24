import * as crypto from 'crypto';

interface RefreshTokenSession {
  tokenId: string;
  userId: string;
  consumed: boolean;
  expiresAt: number;
}

/**
 * OAuthTokenManagerService
 * Implements RFC 7636 PKCE verification and zero-leakage refresh token rotation with reuse detection.
 */
export class OAuthTokenManagerService {
  private readonly sessions = new Map<string, RefreshTokenSession>();
  private readonly userSessions = new Map<string, Set<string>>();

  /**
   * Validates PKCE code_verifier against code_challenge using SHA-256 S256.
   */
  validatePkce(codeVerifier: string, codeChallenge: string, method = 'S256'): boolean {
    if (!codeVerifier || !codeChallenge) return false;

    if (method === 'plain') {
      return codeVerifier === codeChallenge;
    }

    // S256: BASE64URL-ENCODE(SHA256(ASCII(code_verifier))) == code_challenge
    const base64Digest = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    return crypto.timingSafeEqual(Buffer.from(base64Digest), Buffer.from(codeChallenge));
  }

  /**
   * Issues a new rotating refresh token session.
   */
  issueRefreshToken(userId: string, ttlMs = 7 * 24 * 3600 * 1000): string {
    const tokenId = `rt_${crypto.randomBytes(32).toString('hex')}`;
    const session: RefreshTokenSession = {
      tokenId,
      userId,
      consumed: false,
      expiresAt: Date.now() + ttlMs
    };

    this.sessions.set(tokenId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(tokenId);

    return tokenId;
  }

  /**
   * Rotates a refresh token.
   * If a consumed token is presented again, revokes ALL sessions for that user (token theft defense).
   */
  rotateRefreshToken(presentedToken: string): { valid: boolean; newToken?: string; error?: string } {
    const session = this.sessions.get(presentedToken);

    if (!session) {
      return { valid: false, error: 'Invalid or unknown refresh token' };
    }

    // Reuse detection: If token was already consumed, potential theft! Revoke all sessions!
    if (session.consumed) {
      this.revokeAllUserSessions(session.userId);
      return {
        valid: false,
        error: 'Refresh token reuse detected! All user sessions have been terminated for security.'
      };
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(presentedToken);
      return { valid: false, error: 'Refresh token expired' };
    }

    // Mark current token consumed
    session.consumed = true;

    // Issue newly rotated token
    const newToken = this.issueRefreshToken(session.userId);
    return { valid: true, newToken };
  }

  revokeAllUserSessions(userId: string): void {
    const tokenIds = this.userSessions.get(userId);
    if (tokenIds) {
      for (const tid of tokenIds) {
        this.sessions.delete(tid);
      }
      this.userSessions.delete(userId);
    }
  }
}
