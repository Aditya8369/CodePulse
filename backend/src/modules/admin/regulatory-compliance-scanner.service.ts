import { Injectable, Logger } from '@nestjs/common';

export interface SecurityConfig {
  tlsVersion: string;
  encryptionAtRestEnabled: boolean;
  auditLoggingEnabled: boolean;
  sessionTimeoutMinutes: number;
}

@Injectable()
export class RegulatoryComplianceScannerService {
  private readonly logger = new Logger(RegulatoryComplianceScannerService.name);

  public auditCompliance(config: SecurityConfig): { isHipaaCompliant: boolean; isPciCompliant: boolean; violations: string[] } {
    const violations: string[] = [];

    if (config.tlsVersion !== '1.3' && config.tlsVersion !== '1.2') {
      violations.push('INSECURE_TLS_VERSION');
    }
    if (!config.encryptionAtRestEnabled) {
      violations.push('ENCRYPTION_AT_REST_DISABLED');
    }
    if (!config.auditLoggingEnabled) {
      violations.push('AUDIT_LOGGING_DISABLED');
    }
    if (config.sessionTimeoutMinutes > 15) {
      violations.push('EXCESSIVE_SESSION_TIMEOUT');
    }

    const compliant = violations.length === 0;
    return {
      isHipaaCompliant: compliant,
      isPciCompliant: compliant,
      violations
    };
  }
}
