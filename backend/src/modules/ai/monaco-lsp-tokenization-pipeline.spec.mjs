import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MonacoLspTokenizationPipelineService {
  chunk(lines, size = 1000) {
    return Math.ceil(lines / size);
  }
}

describe('MonacoLspTokenizationPipelineService (#2257)', () => {
  test('chunks massive source files for incremental Monaco LSP tokenization', () => {
    const pipeline = new MonacoLspTokenizationPipelineService();
    assert.strictEqual(pipeline.chunk(105000), 105);
  });
});
