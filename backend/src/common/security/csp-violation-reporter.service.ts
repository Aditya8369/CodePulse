export interface CspViolationReport {
  documentUri: string;
  referrer?: string;
  blockedUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition?: string;
  statusCode?: number;
  sample?: string;
  ipAddress?: string;
}

export interface SanitizedViolation {
  id: string;
  timestamp: number;
  blockedUri: string;
  directive: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  isSuspiciousXss: boolean;
  count: number;
}

/**
 * CspViolationReporterService
 * Ingests application/csp-report payloads, sanitizes, deduplicates and flags active XSS attacks.
 */
export class CspViolationReporterService {
  private readonly reports = new Map<string, SanitizedViolation>();
  private readonly maxStored = 5000;

  /**
   * Processes an incoming CSP violation report.
   */
  processReport(raw: CspViolationReport): SanitizedViolation {
    const blocked = raw.blockedUri || 'unknown';
    const directive = raw.effectiveDirective || raw.violatedDirective || 'unknown';
    const key = `${directive}:${blocked}`;

    const isSuspiciousXss =
      blocked.startsWith('data:') ||
      blocked.startsWith('javascript:') ||
      blocked.includes('<script>') ||
      directive.includes('script-src');

    const severity = isSuspiciousXss ? 'CRITICAL' : directive.includes('connect-src') ? 'WARNING' : 'INFO';

    const existing = this.reports.get(key);
    if (existing) {
      existing.count += 1;
      return existing;
    }

    const violation: SanitizedViolation = {
      id: `csp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      blockedUri: blocked,
      directive,
      severity,
      isSuspiciousXss,
      count: 1
    };

    if (this.reports.size >= this.maxStored) {
      const oldestKey = this.reports.keys().next().value;
      if (oldestKey) this.reports.delete(oldestKey);
    }

    this.reports.set(key, violation);
    return violation;
  }

  getViolations(): SanitizedViolation[] {
    return Array.from(this.reports.values()).sort((a, b) => b.count - a.count);
  }

  getCriticalCount(): number {
    return Array.from(this.reports.values()).filter(v => v.severity === 'CRITICAL').length;
  }
}
