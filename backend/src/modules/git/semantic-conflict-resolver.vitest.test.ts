import { describe, it, expect } from 'vitest';
import { GitService } from './git.service';

describe('GitService & SemanticConflictResolverService (Vitest)', () => {
  it('reconciles independent block insertions cleanly across 3-way merge inputs', async () => {
    const gitService = new GitService();
    const out = await gitService.resolveMergeConflictSemantically({
      filePath: 'src/utils/format.ts',
      baseContent: 'export function formatId(id: string) { return id; }',
      oursContent: 'export function formatId(id: string) { return id.trim(); }',
      theirsContent: `
        export function formatId(id: string) { return id; }
        export function formatLatency(ms: number) { return \`\${ms}ms\`; }
      `,
    });

    expect(out.syntaxValid).toBe(true);
    expect(out.resolvedContent).toContain('formatId');
    expect(out.resolvedContent).toContain('formatLatency');
  });
});
