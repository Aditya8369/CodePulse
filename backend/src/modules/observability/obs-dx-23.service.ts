/**
 * Architecture Service: Incident Post-Mortem Markdown Exporter
 * Subsystem: Advanced Observability & Developer Experience [OBS-DX-23]
 */

export interface TimelineEvent {
  timestamp: string;
  source: 'PROMETHEUS' | 'SLACK' | 'OPSGENIE' | 'ENGINEER';
  author?: string;
  description: string;
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  priority: 'P0' | 'P1' | 'P2';
  ticketRef?: string;
}

export interface IncidentData {
  incidentId: string;
  title: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  startedAt: string;
  mitigatedAt: string;
  leadInvestigator: string;
  rootCause: string;
  customerImpact: string;
  timeline: TimelineEvent[];
  actionItems: ActionItem[];
}

export class IncidentPostMortemExporterService {
  public generateMarkdown(data: IncidentData): string {
    const lines: string[] = [];

    lines.push('# Incident Post-Mortem: ' + data.title);
    lines.push('');
    lines.push('**Incident ID:** ' + data.incidentId + '  ');
    lines.push('**Severity:** ' + data.severity + '  ');
    lines.push('**Lead Investigator:** ' + data.leadInvestigator + '  ');
    lines.push('**Duration:** ' + data.startedAt + ' to ' + data.mitigatedAt + '  ');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 1. Executive Summary');
    lines.push(data.customerImpact);
    lines.push('');
    lines.push('## 2. Root Cause Analysis (RCA)');
    lines.push(data.rootCause);
    lines.push('');
    lines.push('## 3. Incident Timeline');
    lines.push('| Timestamp | Source | Author | Event |');
    lines.push('|---|---|---|---|');

    for (const t of data.timeline) {
      lines.push('| ' + t.timestamp + ' | ' + t.source + ' | ' + (t.author || '-') + ' | ' + t.description + ' |');
    }
    lines.push('');

    lines.push('## 4. Preventative Action Items');
    lines.push('| ID | Priority | Action Item | Owner | Ticket |');
    lines.push('|---|---|---|---|---|');

    for (const a of data.actionItems) {
      lines.push('| ' + a.id + ' | ' + a.priority + ' | ' + a.title + ' | ' + a.owner + ' | ' + (a.ticketRef || 'TBD') + ' |');
    }

    return lines.join('\n');
  }

  public validateIncidentData(data: IncidentData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.incidentId) errors.push('Missing incidentId');
    if (!data.title) errors.push('Missing title');
    if (!data.rootCause) errors.push('Missing rootCause');
    if (!data.timeline || data.timeline.length === 0) errors.push('Timeline must contain at least 1 event');
    if (!data.actionItems || data.actionItems.length === 0) errors.push('At least 1 preventative action item is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
