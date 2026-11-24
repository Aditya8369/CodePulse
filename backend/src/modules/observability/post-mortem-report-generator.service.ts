export interface IncidentMeta {
  id: string;
  title: string;
  severity: string;
  durationMinutes: number;
  rootCause: string;
}

export class PostMortemReportGeneratorService {
  public generateReport(meta: IncidentMeta): string {
    return [
      `# 📋 Post-Mortem Incident Report: ${meta.id}`,
      `**Title:** ${meta.title}`,
      `**Severity:** ${meta.severity}`,
      `**Downtime Duration:** ${meta.durationMinutes} minutes`,
      '',
      '## 🔍 Root Cause Analysis',
      meta.rootCause,
      '',
      '## 🛠️ Preventive Action Items',
      '- [ ] Review architectural safeguards and health checks',
      '- [ ] Update integration tests covering failure scenario'
    ].join('\n');
  }
}
