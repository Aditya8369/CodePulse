/**
 * Architecture Service 49: Service Mesh mTLS Dynamic Rotation Daemon
 * Subsystem: Zero-Downtime Certificate Rotation
 */

export interface CertBundle {
  certPem: string;
  keyPem: string;
  version: number;
}

export class MtlsCertificateRotationDaemonService {
  private activeBundle: CertBundle | null = null;

  public rotateCertificate(newCert: string, newKey: string): CertBundle {
    const version = (this.activeBundle?.version || 0) + 1;
    this.activeBundle = {
      certPem: newCert,
      keyPem: newKey,
      version,
    };
    return { ...this.activeBundle };
  }

  public getActiveCertificate(): CertBundle | null {
    return this.activeBundle ? { ...this.activeBundle } : null;
  }
}
