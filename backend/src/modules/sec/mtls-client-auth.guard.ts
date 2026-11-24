export interface ClientCertContext {
  fingerprint256: string;
  subjectDN: string;
  authorized: boolean;
}

export class MTLSClientAuthGuard {
  private allowedFingerprints = new Set<string>();

  public registerTrustedClient(fingerprint: string): void {
    this.allowedFingerprints.add(fingerprint.toUpperCase());
  }

  public validateCert(cert: ClientCertContext): boolean {
    if (!cert.authorized) return false;
    return this.allowedFingerprints.has(cert.fingerprint256.toUpperCase());
  }
}
