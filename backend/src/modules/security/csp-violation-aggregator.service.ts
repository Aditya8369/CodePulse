import { Injectable } from '@nestjs/common';

export interface CspReport {
  blockedUri: string;
  violatedDirective: string;
  sourceFile: string;
}

@Injectable()
export class CspViolationAggregatorService {
  private readonly reports = new Map<string, number>();

  public recordViolation(report: CspReport): { count: number; isNew: boolean } {
    const key = `${report.violatedDirective}:${report.blockedUri}`;
    const count = (this.reports.get(key) || 0) + 1;
    this.reports.set(key, count);
    return { count, isNew: count === 1 };
  }

  public getSummary(): Record<string, number> {
    return Object.fromEntries(this.reports.entries());
  }
}
