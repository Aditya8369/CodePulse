import { Injectable } from '@nestjs/common';

export interface ClientCertMetadata {
  fingerprint256: string;
  subjectCommonName: string;
  issuerCommonName: string;
  validTo: number;
}

@Injectable()
export class ZeroTrustMtlsVerifierService {
  private readonly authorizedSpiffeIds = new Set(['spiffe://codepulse.internal/ns/runner/sa/sandbox']);

  public verifyCertificate(cert: ClientCertMetadata): { authorized: boolean; reason?: string } {
    if (Date.now() > cert.validTo) {
      return { authorized: false, reason: 'Client mTLS certificate expired' };
    }

    if (!this.authorizedSpiffeIds.has(cert.subjectCommonName)) {
      return { authorized: false, reason: 'Client certificate identity not authorized in zero-trust mesh' };
    }

    return { authorized: true };
  }
}
