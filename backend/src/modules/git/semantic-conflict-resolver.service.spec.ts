import { SemanticConflictResolverService } from './semantic-conflict-resolver.service';

describe('SemanticConflictResolverService (3-Way AST Diff, Confidence Threshold & Fallback)', () => {
  let service: SemanticConflictResolverService;

  beforeEach(() => {
    service = new SemanticConflictResolverService();
  });

  it('resolves non-overlapping function renames and independent block insertions with valid TS syntax', async () => {
    const base = `
      export function computeScore(points: number): number {
        return points * 2;
      }
    `;
    const ours = `
      export function computeWeightedScore(points: number): number {
        return points * 2 + 5;
      }
    `;
    const theirs = `
      export function computeScore(points: number): number {
        return points * 2;
      }

      export function auditScoreLog(score: number): string {
        return \`score:\${score}\`;
      }
    `;

    const res = await service.resolve3WaySemanticConflict({
      filePath: 'backend/src/modules/scoring/scorer.ts',
      baseContent: base,
      oursContent: ours,
      theirsContent: theirs,
    });

    expect(res.resolvedByAi).toBe(true);
    expect(res.fellBackToManual).toBe(false);
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(res.syntaxValid).toBe(true);
    expect(res.syntaxErrors).toHaveLength(0);
    expect(res.resolvedContent).toContain('computeWeightedScore');
    expect(res.resolvedContent).toContain('auditScoreLog');
  });

  it('falls back to manual conflict markers when confidence score is below 0.85', async () => {
    const res = await service.resolve3WaySemanticConflict({
      filePath: 'backend/src/modules/auth/session.ts',
      baseContent: 'export function initSession() { return 1; }',
      oursContent: 'export function initSession() { return 2; }',
      theirsContent: 'export function initSession() { return 3; }',
      forceLowConfidence: true,
    });

    expect(res.confidenceScore).toBeLessThan(0.85);
    expect(res.fellBackToManual).toBe(true);
    expect(res.resolvedByAi).toBe(false);
    expect(res.resolvedContent).toContain('<<<<<<< OURS');
    expect(res.resolvedContent).toContain('=======');
    expect(res.resolvedContent).toContain('>>>>>>> THEIRS');
  });
});
