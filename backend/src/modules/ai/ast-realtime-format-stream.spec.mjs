import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AstRealtimeFormatStreamService {
  fmt(c) {
    return c.split(';').map(x => x.trim()).filter(Boolean).join(';\n') + ';\n';
  }
}

describe('AstRealtimeFormatStreamService (#2282)', () => {
  test('formats unformatted source snippets into clean multi-line statements', () => {
    const formatter = new AstRealtimeFormatStreamService();
    assert.strictEqual(formatter.fmt('let a = 1; let b = 2;'), 'let a = 1;\nlet b = 2;\n');
  });
});
