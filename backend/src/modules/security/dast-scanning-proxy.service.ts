import { Injectable } from '@nestjs/common';

export interface DastFinding {
  route: string;
  vulnerabilityType: string;
  riskSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

@Injectable()
export class DastScanningProxyService {
  public scanRoute(route: string, headers: Record<string, string>): DastFinding[] {
    const findings: DastFinding[] = [];
    if (!headers['authorization']) {
      findings.push({ route, vulnerabilityType: 'UNPROTECTED_ENDPOINT', riskSeverity: 'HIGH' });
    }
    if (route.includes('../')) {
      findings.push({ route, vulnerabilityType: 'PATH_TRAVERSAL', riskSeverity: 'CRITICAL' });
    }
    return findings;
  }
}
