import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DeveloperSnapshot {
  username: string;
  name: string;
  eloRating: number;
  totalCommits: number;
  pullRequestsMerged: number;
  topLanguages: string[];
  achievements: string[];
}

export interface VerifiedCredential {
  id: string;
  userId: string;
  credentialHash: string;
  signature: string;
  issuedAt: string;
  expiresAt: string;
  verificationUrl: string;
  snapshot: DeveloperSnapshot;
  isValid: boolean;
}

@Injectable()
export class CredentialsService {
  private readonly secretKey = process.env.CREDENTIAL_SIGNING_KEY || 'codepulse-verifiable-credentials-secret-2026';

  /**
   * Generates a tamper-proof cryptographic developer CV with SHA-256 HMAC signature
   */
  generateDeveloperCV(userId: string, snapshot: DeveloperSnapshot): VerifiedCredential {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const canonicalData = JSON.stringify({
      userId,
      snapshot,
      issuedAt,
    });

    const credentialHash = crypto.createHash('sha256').update(canonicalData).digest('hex');
    const signature = crypto.createHmac('sha256', this.secretKey).update(credentialHash).digest('hex');

    return {
      id: `cred_${credentialHash.substring(0, 12)}`,
      userId,
      credentialHash,
      signature,
      issuedAt,
      expiresAt,
      verificationUrl: `https://codepulse.dev/verify/${credentialHash}`,
      snapshot,
      isValid: true,
    };
  }

  /**
   * Mathematically verifies whether a credential hash matches signature and has not been tampered
   */
  verifyCredential(credentialHash: string, signature: string): { verified: boolean; status: string } {
    const expectedSig = crypto.createHmac('sha256', this.secretKey).update(credentialHash).digest('hex');
    const isAuthentic = expectedSig === signature;

    return {
      verified: isAuthentic,
      status: isAuthentic ? 'VALID' : 'TAMPERED',
    };
  }
}
