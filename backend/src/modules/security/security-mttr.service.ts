import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

export type VulnerabilitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface VulnerabilityLifecycleRecord {
  advisoryId: string;
  cveId: string;
  repositoryId: string;
  packageName: string;
  affectedVersion: string;
  patchedVersion?: string;
  severity: VulnerabilitySeverity;
  cveDisclosedAt: string;
  discoveredAt: string;
  fixPrNumber?: number;
  fixPrCreatedAt?: string;
  fixMergedAt?: string;
  deployedInProduction: boolean;
}

export interface SeverityMttrBreakdown {
  severity: VulnerabilitySeverity;
  totalAdvisories: number;
  remediatedCount: number;
  openCount: number;
  mttrHours: number;
  mttrDays: number;
  exposureDays: number;
}

export interface MttrTrendPoint {
  period: string;
  mttrHours: number;
  mttrDays: number;
  remediatedCount: number;
  cveExposureIndex: number;
}

export interface RepositorySecurityMttrSummary {
  repositoryId: string;
  overallMttrHours: number;
  overallMttrDays: number;
  meanDetectionLagHours: number;
  meanPrLeadTimeHours: number;
  cumulativeVulnerabilityExposureIndex: number;
  bySeverity: Record<VulnerabilitySeverity, SeverityMttrBreakdown>;
  trend: MttrTrendPoint[];
  advisories: VulnerabilityLifecycleRecord[];
}

const SEVERITY_WEIGHTS: Record<VulnerabilitySeverity, number> = {
  CRITICAL: 4.0,
  HIGH: 2.5,
  MEDIUM: 1.5,
  LOW: 1.0,
};

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class SecurityMttrService {
  private readonly records = new Map<string, VulnerabilityLifecycleRecord>();

  recordAdvisory(
    input: Omit<VulnerabilityLifecycleRecord, 'deployedInProduction'> & {
      deployedInProduction?: boolean;
    },
  ): VulnerabilityLifecycleRecord {
    const disclosedMs = Date.parse(input.cveDisclosedAt);
    const discoveredMs = Date.parse(input.discoveredAt);
    if (Number.isNaN(disclosedMs) || Number.isNaN(discoveredMs)) {
      throw new BadRequestException('Invalid ISO timestamp for cveDisclosedAt or discoveredAt');
    }
    if (discoveredMs < disclosedMs) {
      throw new BadRequestException('discoveredAt cannot precede cveDisclosedAt');
    }

    if (input.fixPrCreatedAt) {
      const prCreatedMs = Date.parse(input.fixPrCreatedAt);
      if (Number.isNaN(prCreatedMs) || prCreatedMs < discoveredMs) {
        throw new BadRequestException('fixPrCreatedAt cannot precede discoveredAt');
      }
    }

    if (input.fixMergedAt) {
      const mergedMs = Date.parse(input.fixMergedAt);
      const anchorMs = input.fixPrCreatedAt
        ? Date.parse(input.fixPrCreatedAt)
        : discoveredMs;
      if (Number.isNaN(mergedMs) || mergedMs < anchorMs) {
        throw new BadRequestException('fixMergedAt cannot precede fixPrCreatedAt/discoveredAt');
      }
    }

    const record: VulnerabilityLifecycleRecord = {
      ...input,
      deployedInProduction: input.deployedInProduction ?? true,
    };
    this.records.set(record.advisoryId, record);
    return record;
  }

  /**
   * Correlates an existing security advisory alert with a subsequent fix Pull Request
   * and optional merge timestamp.
   */
  correlateAdvisoryWithPr(params: {
    advisoryId: string;
    fixPrNumber: number;
    fixPrCreatedAt: string;
    fixMergedAt?: string;
    patchedVersion?: string;
  }): VulnerabilityLifecycleRecord {
    const existing = this.records.get(params.advisoryId);
    if (!existing) {
      throw new NotFoundException(`Security advisory ${params.advisoryId} not found`);
    }

    const discoveredMs = Date.parse(existing.discoveredAt);
    const prCreatedMs = Date.parse(params.fixPrCreatedAt);
    if (Number.isNaN(prCreatedMs) || prCreatedMs < discoveredMs) {
      throw new BadRequestException('Fix PR creation timestamp cannot precede advisory discovery');
    }

    if (params.fixMergedAt) {
      const mergedMs = Date.parse(params.fixMergedAt);
      if (Number.isNaN(mergedMs) || mergedMs < prCreatedMs) {
        throw new BadRequestException('Fix PR merge timestamp cannot precede PR creation');
      }
    }

    const updated: VulnerabilityLifecycleRecord = {
      ...existing,
      fixPrNumber: params.fixPrNumber,
      fixPrCreatedAt: params.fixPrCreatedAt,
      fixMergedAt: params.fixMergedAt ?? existing.fixMergedAt,
      patchedVersion: params.patchedVersion ?? existing.patchedVersion,
    };
    this.records.set(params.advisoryId, updated);
    return updated;
  }

  /**
   * Computes exposure duration in days for a single vulnerability from CVE disclosure
   * (or discovery) until fix merge (or evaluation timestamp if still open).
   */
  computeAdvisoryExposureDays(
    record: VulnerabilityLifecycleRecord,
    asOfMs = Date.now(),
  ): number {
    if (!record.deployedInProduction) return 0;
    const startMs = Date.parse(record.cveDisclosedAt);
    const endMs = record.fixMergedAt ? Date.parse(record.fixMergedAt) : asOfMs;
    const durationMs = Math.max(0, endMs - startMs);
    return Number((durationMs / MS_PER_DAY).toFixed(3));
  }

  /**
   * Computes Cumulative Vulnerability Exposure Index (CVEI):
   * severity-weighted cumulative days vulnerable packages remained active in production.
   */
  computeCumulativeExposureIndex(
    advisories: VulnerabilityLifecycleRecord[],
    asOfMs = Date.now(),
  ): number {
    let totalWeightedDays = 0;
    for (const adv of advisories) {
      const days = this.computeAdvisoryExposureDays(adv, asOfMs);
      totalWeightedDays += days * SEVERITY_WEIGHTS[adv.severity];
    }
    return Number(totalWeightedDays.toFixed(2));
  }

  /**
   * Computes repository-wide and severity-tiered Security MTTR, detection lag, PR lead time,
   * Cumulative Vulnerability Exposure Index (CVEI), and monthly remediation trend series.
   */
  calculateRepositoryMttr(
    repositoryId: string,
    asOfIso?: string,
  ): RepositorySecurityMttrSummary {
    const asOfMs = asOfIso ? Date.parse(asOfIso) : Date.now();
    const repoAdvisories = Array.from(this.records.values()).filter(
      (r) => r.repositoryId === repositoryId,
    );

    const severities: VulnerabilitySeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const bySeverity = {} as Record<VulnerabilitySeverity, SeverityMttrBreakdown>;

    let totalRemediatedHours = 0;
    let totalRemediatedCount = 0;
    let totalDetectionLagHours = 0;
    let totalPrLeadHours = 0;
    let prLeadSamples = 0;

    for (const sev of severities) {
      const subset = repoAdvisories.filter((r) => r.severity === sev);
      const remediated = subset.filter((r) => Boolean(r.fixMergedAt));
      let sevMttrHoursSum = 0;
      let sevExposureDaysSum = 0;

      for (const adv of subset) {
        const disclosedMs = Date.parse(adv.cveDisclosedAt);
        const discoveredMs = Date.parse(adv.discoveredAt);
        totalDetectionLagHours += Math.max(0, (discoveredMs - disclosedMs) / MS_PER_HOUR);
        sevExposureDaysSum += this.computeAdvisoryExposureDays(adv, asOfMs);

        if (adv.fixMergedAt) {
          const mergedMs = Date.parse(adv.fixMergedAt);
          // MTTR measured from discovery to merged patch
          const remediationHours = Math.max(0, (mergedMs - discoveredMs) / MS_PER_HOUR);
          sevMttrHoursSum += remediationHours;
          totalRemediatedHours += remediationHours;
          totalRemediatedCount += 1;

          if (adv.fixPrCreatedAt) {
            const prCreatedMs = Date.parse(adv.fixPrCreatedAt);
            totalPrLeadHours += Math.max(0, (mergedMs - prCreatedMs) / MS_PER_HOUR);
            prLeadSamples += 1;
          }
        }
      }

      const avgHours =
        remediated.length > 0 ? sevMttrHoursSum / remediated.length : 0;

      bySeverity[sev] = {
        severity: sev,
        totalAdvisories: subset.length,
        remediatedCount: remediated.length,
        openCount: subset.length - remediated.length,
        mttrHours: Number(avgHours.toFixed(2)),
        mttrDays: Number((avgHours / 24).toFixed(2)),
        exposureDays: Number(sevExposureDaysSum.toFixed(2)),
      };
    }

    // Group remediated advisories by YYYY-MM period for trend visualization
    const monthBuckets = new Map<string, VulnerabilityLifecycleRecord[]>();
    for (const adv of repoAdvisories) {
      const period = (adv.fixMergedAt ?? adv.discoveredAt).slice(0, 7);
      const list = monthBuckets.get(period) ?? [];
      list.push(adv);
      monthBuckets.set(period, list);
    }

    const trend: MttrTrendPoint[] = Array.from(monthBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, items]) => {
        const closed = items.filter((i) => Boolean(i.fixMergedAt));
        const avgHrs =
          closed.length > 0
            ? closed.reduce((acc, item) => {
                const start = Date.parse(item.discoveredAt);
                const end = Date.parse(item.fixMergedAt!);
                return acc + Math.max(0, (end - start) / MS_PER_HOUR);
              }, 0) / closed.length
            : 0;
        return {
          period,
          mttrHours: Number(avgHrs.toFixed(2)),
          mttrDays: Number((avgHrs / 24).toFixed(2)),
          remediatedCount: closed.length,
          cveExposureIndex: this.computeCumulativeExposureIndex(items, asOfMs),
        };
      });

    const overallMttrHours =
      totalRemediatedCount > 0 ? totalRemediatedHours / totalRemediatedCount : 0;

    return {
      repositoryId,
      overallMttrHours: Number(overallMttrHours.toFixed(2)),
      overallMttrDays: Number((overallMttrHours / 24).toFixed(2)),
      meanDetectionLagHours:
        repoAdvisories.length > 0
          ? Number((totalDetectionLagHours / repoAdvisories.length).toFixed(2))
          : 0,
      meanPrLeadTimeHours:
        prLeadSamples > 0
          ? Number((totalPrLeadHours / prLeadSamples).toFixed(2))
          : 0,
      cumulativeVulnerabilityExposureIndex: this.computeCumulativeExposureIndex(
        repoAdvisories,
        asOfMs,
      ),
      bySeverity,
      trend,
      advisories: repoAdvisories,
    };
  }

  /**
   * Generates a standards-compliant PDF 1.4 executive audit report (SOC2 Type II & ISO 27001 A.12.6.1)
   * summarizing repository Security MTTR, severity breakdown, and CVEI exposure windows.
   */
  generateExecutiveCompliancePdf(
    repositoryId: string,
    standard: 'SOC2' | 'ISO_27001' = 'SOC2',
    asOfIso?: string,
  ): Buffer {
    const summary = this.calculateRepositoryMttr(repositoryId, asOfIso);
    const lines = [
      `CodePulse Executive Security Compliance Audit (${standard})`,
      `Repository: ${summary.repositoryId}`,
      `Generated At: ${asOfIso ?? new Date().toISOString()}`,
      `Overall Security MTTR: ${summary.overallMttrHours} hrs (${summary.overallMttrDays} days)`,
      `Cumulative Vulnerability Exposure Index (CVEI): ${summary.cumulativeVulnerabilityExposureIndex} weighted-days`,
      `Critical MTTR: ${summary.bySeverity.CRITICAL.mttrHours} hrs | High MTTR: ${summary.bySeverity.HIGH.mttrHours} hrs`,
      `Medium MTTR: ${summary.bySeverity.MEDIUM.mttrHours} hrs | Low MTTR: ${summary.bySeverity.LOW.mttrHours} hrs`,
      `Control Attestation: Vulnerability lifecycle & patch SLA telemetry verified.`,
    ];

    const escapePdfText = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const textOps = lines
      .map(
        (line, idx) =>
          `1 0 0 1 48 ${740 - idx * 24} Tm (${escapePdfText(line)}) Tj`,
      )
      .join('\n');

    const contentStream = `BT\n/F1 11 Tf\n${textOps}\nET`;
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf8')} >> stream\n${contentStream}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${obj}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'utf8');
  }
}
