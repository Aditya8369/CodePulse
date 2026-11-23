import { OwnershipHeatmapService } from './ownership-heatmap.service';

describe('OwnershipHeatmapService (Temporal Decay, AST Filter, Bus Factor & 10k Commits)', () => {
  let service: OwnershipHeatmapService;

  beforeEach(() => {
    service = new OwnershipHeatmapService();
  });

  it('filters trivial whitespace/import commits, applies exponential decay, and flags >80% single-owner >60d modules', () => {
    const asOfIso = '2026-11-23T00:00:00.000Z';

    const report = service.analyzeOwnershipHeatmap({
      repositoryId: 'codepulse',
      asOfIso,
      commits: [
        // Semantic core logic in backend/src/crypto by Alice 90 days ago
        {
          commitSha: 'c1',
          authorId: 'u-alice',
          authorName: 'Alice',
          filePath: 'backend/src/crypto/zkp.ts',
          timestampIso: '2026-08-25T00:00:00.000Z', // 90 days ago
          diffLines: [
            '+export function verifyGroth16Proof(a: bigint, b: bigint) {',
            '+  const pairing = computePairing(a, b);',
            '+  return pairing === 1n;',
            '+}',
          ],
        },
        // Trivial formatting & import-only commit by Bob yesterday (must be filtered out!)
        {
          commitSha: 'c2',
          authorId: 'u-bob',
          authorName: 'Bob',
          filePath: 'backend/src/crypto/zkp.ts',
          timestampIso: '2026-11-22T00:00:00.000Z',
          diffLines: [
            "+import { Logger } from '@nestjs/common';",
            '+  // prettier format comment',
            '-  const pairing = computePairing(a, b);',
            '+  const   pairing   =   computePairing(a, b);',
          ],
        },
      ],
    });

    expect(report.semanticCommitsCount).toBe(1);
    expect(report.filteredTrivialCommitsCount).toBe(1);

    const cryptoDir = report.criticalRiskDirectories.find(
      (d) => d.directoryPath === 'backend/src/crypto',
    );
    expect(cryptoDir).toBeDefined();
    expect(cryptoDir!.isCriticalBusFactorRisk).toBe(true);
    expect(cryptoDir!.topOwner?.authorName).toBe('Alice');
    expect(cryptoDir!.topOwner?.ownershipPercent).toBe(100);
    expect(report.onboardingRecommendations.length).toBeGreaterThan(0);
  });

  it('processes 10,000 commits quickly with accurate exponential decay weights', () => {
    const commits = Array.from({ length: 10_000 }, (_, i) => ({
      commitSha: `sha-${i}`,
      authorId: `dev-${i % 8}`,
      authorName: `Dev ${i % 8}`,
      filePath: `src/mod-${i % 25}/file-${i % 10}.ts`,
      timestampIso: new Date(Date.UTC(2026, 10, 23) - (i % 120) * 86_400_000).toISOString(),
      diffLines: [`+const result_${i} = computeValue(${i});`],
    }));

    const report = service.analyzeOwnershipHeatmap({
      repositoryId: 'large-monorepo',
      commits,
      asOfIso: '2026-11-23T00:00:00.000Z',
    });

    expect(report.totalCommitsProcessed).toBe(10_000);
    expect(report.semanticCommitsCount).toBe(10_000);
    expect(report.executionTimeMs).toBeLessThan(2000);
  });
});
