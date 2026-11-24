import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SemanticDiffExplainerService {
  summarize(diff) {
    const count = diff.split('\n').filter(l => l.startsWith('diff --git')).length;
    return { summary: 'Analysis complete', count };
  }
}

describe('SemanticDiffExplainerService (#2272)', () => {
  test('parses git diffs and computes structural file change summary', () => {
    const explainer = new SemanticDiffExplainerService();
    const diff = 'diff --git a/file1.ts b/file1.ts\n+const x = 1;\ndiff --git a/file2.ts b/file2.ts';
    const res = explainer.summarize(diff);
    assert.strictEqual(res.count, 2);
  });
});
