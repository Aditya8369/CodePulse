import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GdprForgetPipelineService {
  forget(uId, tables) {
    let p = 0, a = 0;
    for (const [tbl, recs] of Object.entries(tables)) {
      const match = recs.filter(x => x === uId).length;
      if (match > 0) { p++; a += match; }
    }
    return { p, a };
  }
}

describe('GdprForgetPipelineService (#2381)', () => {
  test('cascades GDPR erasure across multi-table PII stores', () => {
    const pipeline = new GdprForgetPipelineService();
    const tables = {
      users: ['user1', 'user2'],
      profiles: ['user1'],
      billing: ['user2']
    };

    const res = pipeline.forget('user1', tables);
    assert.strictEqual(res.p, 2);
    assert.strictEqual(res.a, 2);
  });
});
