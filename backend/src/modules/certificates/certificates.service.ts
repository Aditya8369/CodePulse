import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CertificateMetadata {
  id: string;
  recipientName: string;
  recipientUsername: string;
  achievementTitle: string;
  category: 'NSOC_COMPLETION' | 'LEVEL_3_CHAMPION' | 'TOP_CONTRIBUTOR' | 'DEV_BATTLE_LEGEND';
  issuedAt: string;
  sha256Fingerprint: string;
  verificationUrl: string;
  issuer: string;
}

@Injectable()
export class CertificatesService {
  private readonly secretSalt = process.env.CERTIFICATE_SALT || 'codepulse-nsoc-cryptographic-salt-2026';

  /**
   * Generates a tamper-proof cryptographic certificate record and SHA256 digest
   */
  async generateCertificate(params: {
    recipientName: string;
    recipientUsername: string;
    achievementTitle: string;
    category: CertificateMetadata['category'];
  }): Promise<CertificateMetadata> {
    const certId = `CP-CERT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const issuedAt = new Date().toISOString();

    const rawPayload = `${certId}|${params.recipientUsername}|${params.achievementTitle}|${issuedAt}|${this.secretSalt}`;
    const sha256Fingerprint = crypto.createHash('sha256').update(rawPayload).digest('hex');

    return {
      id: certId,
      recipientName: params.recipientName,
      recipientUsername: params.recipientUsername,
      achievementTitle: params.achievementTitle,
      category: params.category,
      issuedAt,
      sha256Fingerprint,
      verificationUrl: `https://codepulse.dev/verify/${certId}`,
      issuer: 'Nexus Spring of Code (NSoC) & CodePulse Foundation',
    };
  }

  /**
   * Verifies certificate authenticity against hash fingerprint
   */
  async verifyCertificate(certId: string, claimedFingerprint: string, issuedAt: string, username: string, title: string): Promise<boolean> {
    const expectedPayload = `${certId}|${username}|${title}|${issuedAt}|${this.secretSalt}`;
    const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex');
    return expectedHash === claimedFingerprint;
  }
}
