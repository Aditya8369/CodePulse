import crypto from 'crypto';

export interface VerifiableCredential {
  context: string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, any>;
  proof: {
    type: string;
    signature: string;
  };
}

export class VerifiableCredentialExporterService {
  private secretKey: string;

  constructor(secretKey: string = 'master-badge-signer-key-xyz') {
    this.secretKey = secretKey;
  }

  public exportBadge(userId: string, achievement: string): VerifiableCredential {
    const subject = { id: `did:codepulse:user:${userId}`, achievement };
    const hmac = crypto.createHmac('sha256', this.secretKey).update(JSON.stringify(subject)).digest('hex');

    return {
      context: ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${userId}-${Date.now()}`,
      type: ['VerifiableCredential', 'CodingAchievementBadge'],
      issuer: 'did:codepulse:issuer',
      issuanceDate: new Date().toISOString(),
      credentialSubject: subject,
      proof: {
        type: 'HmacSha256Signature2026',
        signature: hmac
      }
    };
  }
}
