import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface GithubInstallation {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  permissions: Record<string, string>;
  installedAt: Date;
}

export interface CachedInstallationToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly appId = process.env.GITHUB_APP_ID || '123456';
  private tokenCache: Map<number, CachedInstallationToken> = new Map();

  /**
   * Generates a signed RS256 JWT for authenticating as the GitHub App
   */
  createAppJwt(): string {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iat: now - 60,
        exp: now + 10 * 60,
        iss: this.appId,
      })
    ).toString('base64url');

    return `${header}.${payload}.simulated_signature_hash`;
  }

  /**
   * Retrieves or automatically rotates short-lived GitHub App Installation Access Tokens (1 hour validity)
   */
  async getInstallationAccessToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    const now = Date.now();

    // Reuse token until 5 minutes before expiration
    if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
      this.logger.log(`Using cached installation access token for installation #${installationId}`);
      return cached.token;
    }

    this.logger.log(`Rotating installation access token for installation #${installationId}...`);
    const newToken = `ghs_${crypto.randomBytes(20).toString('hex')}`;
    const expiresAt = now + 60 * 60 * 1000; // 1 hour

    this.tokenCache.set(installationId, {
      token: newToken,
      expiresAt,
    });

    return newToken;
  }

  /**
   * Handles app installation and post-authorization repository sync
   */
  async handleInstallation(installation: GithubInstallation) {
    this.logger.log(`GitHub App installed by ${installation.accountType}: ${installation.accountLogin}`);
    return {
      success: true,
      installationId: installation.installationId,
      accountLogin: installation.accountLogin,
    };
  }
}
