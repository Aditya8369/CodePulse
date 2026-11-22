import { SecurityMttrService } from './security-mttr.service';

describe('SecurityMttrService (Exposure Windows, CVEI & Compliance Audit PDF)', () => {
  let service: SecurityMttrService;

  beforeEach(() => {
    service = new SecurityMttrService();
  });

  it('tracks full vulnerability lifecycle, correlates fix PRs, and calculates severity-tiered MTTR and CVEI', () => {
    // Critical CVE disclosed Day 1 00:00, discovered Day 1 06:00, Fix PR created Day 1 12:00, merged Day 2 06:00 (24h remediation, 30h = 1.25d exposure)
    service.recordAdvisory({
      advisoryId: 'adv-crit-1',
      cveId: 'CVE-2026-1001',
      repositoryId: 'repo-core',
      packageName: 'jsonwebtoken',
      affectedVersion: '8.5.1',
      severity: 'CRITICAL',
      cveDisclosedAt: '2026-10-01T00:00:00.000Z',
      discoveredAt: '2026-10-01T06:00:00.000Z',
    });

    service.correlateAdvisoryWithPr({
      advisoryId: 'adv-crit-1',
      fixPrNumber: 412,
      fixPrCreatedAt: '2026-10-01T12:00:00.000Z',
      fixMergedAt: '2026-10-02T06:00:00.000Z',
      patchedVersion: '9.0.2',
    });

    // Medium CVE disclosed Day 1 00:00, discovered Day 2 00:00, merged Day 4 00:00 (48h remediation, 72h = 3.0d exposure)
    service.recordAdvisory({
      advisoryId: 'adv-med-1',
      cveId: 'CVE-2026-2044',
      repositoryId: 'repo-core',
      packageName: 'minimist',
      affectedVersion: '1.2.5',
      severity: 'MEDIUM',
      cveDisclosedAt: '2026-10-01T00:00:00.000Z',
      discoveredAt: '2026-10-02T00:00:00.000Z',
      fixPrNumber: 419,
      fixPrCreatedAt: '2026-10-03T00:00:00.000Z',
      fixMergedAt: '2026-10-04T00:00:00.000Z',
    });

    const metrics = service.calculateRepositoryMttr(
      'repo-core',
      '2026-10-05T00:00:00.000Z',
    );

    expect(metrics.bySeverity.CRITICAL.mttrHours).toBe(24);
    expect(metrics.bySeverity.MEDIUM.mttrHours).toBe(48);
    expect(metrics.overallMttrHours).toBe(36);
    expect(metrics.meanDetectionLagHours).toBe(15);
    expect(metrics.meanPrLeadTimeHours).toBe(21);

    // CVEI = 1.25d * 4.0 (CRITICAL) + 3.0d * 1.5 (MEDIUM) = 5.0 + 4.5 = 9.5
    expect(metrics.cumulativeVulnerabilityExposureIndex).toBe(9.5);
  });

  it('generates a valid %PDF-1.4 executive compliance report for SOC2 and ISO 27001 audits', () => {
    service.recordAdvisory({
      advisoryId: 'adv-iso-1',
      cveId: 'CVE-2026-9901',
      repositoryId: 'repo-enterprise',
      packageName: 'openssl-wrapper',
      affectedVersion: '1.0.0',
      severity: 'HIGH',
      cveDisclosedAt: '2026-11-01T00:00:00.000Z',
      discoveredAt: '2026-11-01T02:00:00.000Z',
      fixPrNumber: 88,
      fixPrCreatedAt: '2026-11-01T04:00:00.000Z',
      fixMergedAt: '2026-11-01T14:00:00.000Z',
    });

    const pdfBuf = service.generateExecutiveCompliancePdf(
      'repo-enterprise',
      'ISO_27001',
      '2026-11-02T00:00:00.000Z',
    );
    const pdfText = pdfBuf.toString('utf8');

    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('ISO_27001');
    expect(pdfText).toContain('repo-enterprise');
    expect(pdfText).toContain('Overall Security MTTR: 12 hrs');
  });
});
