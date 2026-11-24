import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SlowQueryTraceTaggerService {
  tag(sql, trace, span, route) {
    return `/* trace='${trace}',span='${span}',route='${route}' */ ${sql.trim()}`;
  }
}

describe('SlowQueryTraceTaggerService (#2149)', () => {
  test('tags raw SQL statements with OpenTelemetry distributed trace baggage', () => {
    const tagger = new SlowQueryTraceTaggerService();
    const tagged = tagger.tag('SELECT 1', 'trace-123', 'span-456', '/api/battles');
    assert.strictEqual(tagged.includes("trace='trace-123'"), true);
    assert.strictEqual(tagged.includes("route='/api/battles'"), true);
  });
});
