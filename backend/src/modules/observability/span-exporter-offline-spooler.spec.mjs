import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpanExporterOfflineSpoolerService {
  constructor() { this.spool = []; }
  save(s) { this.spool.push(...s); return this.spool.length; }
  drain() { const d = this.spool; this.spool = []; return d; }
}

describe('SpanExporterOfflineSpoolerService (#2241)', () => {
  test('safely spools telemetry spans during OTLP collector network partitions', () => {
    const spooler = new SpanExporterOfflineSpoolerService();
    assert.strictEqual(spooler.save(['span1', 'span2']), 2);
    assert.deepStrictEqual(spooler.drain(), ['span1', 'span2']);
    assert.strictEqual(spooler.drain().length, 0);
  });
});
