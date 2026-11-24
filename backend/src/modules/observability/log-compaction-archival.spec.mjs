import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LogCompactionArchivalService {
  compactLines(lines) { return { compactedPayload: lines.join('\n'), count: lines.length }; }
  generateArchiveKey(p, d = new Date()) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${p}/${y}/${m}/logs.gz`;
  }
}

describe('LogCompactionArchivalService (Issue #1909)', () => {
  it('should compact log record batches and generate deterministic S3 storage keys', () => {
    const service = new LogCompactionArchivalService();
    const res = service.compactLines(['log1', 'log2', 'log3']);
    assert.equal(res.count, 3);
    assert.equal(res.compactedPayload, 'log1\nlog2\nlog3');

    const key = service.generateArchiveKey('cold-logs', new Date('2026-11-24T00:00:00Z'));
    assert.equal(key, 'cold-logs/2026/11/logs.gz');
  });
});
