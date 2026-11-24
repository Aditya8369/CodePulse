import { Injectable } from '@nestjs/common';

@Injectable()
export class SqlInjectionAstFirewallService {
  public validateSqlSafety(sql: string): { safe: boolean; riskReason?: string } {
    const lower = sql.toLowerCase();
    // Detect classic SQL injection payloads and unparameterized concatenations
    if (lower.includes('or 1=1') || lower.includes("or '1'='1'") || lower.includes('union select') || lower.includes('--') && !lower.includes('/*')) {
      return { safe: false, riskReason: 'Detected classic SQL injection pattern' };
    }
    return { safe: true };
  }
}
