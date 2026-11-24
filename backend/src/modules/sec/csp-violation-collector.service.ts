export interface CSPReport {
  documentUri: string;
  blockedUri: string;
  violatedDirective: string;
}

export class CSPViolationCollectorService {
  private reports: CSPReport[] = [];

  public collect(report: CSPReport): void {
    this.reports.push(report);
  }

  public getViolationsCount(): number {
    return this.reports.length;
  }

  public getReports(): CSPReport[] {
    return [...this.reports];
  }
}
