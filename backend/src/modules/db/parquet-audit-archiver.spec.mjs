import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ParquetAuditArchiverService {
  partition(records) {
    const parts = {};
    for (const r of records) {
      const d = new Date(r.ts).toISOString().split('T')[0];
      if (!parts[d]) parts[d] = [];
      parts[d].push(r);
    }
    return parts;
  }
}

describe('ParquetAuditArchiverService (#2148)', () => {
  test('partitions audit log records by ISO date partitions for Parquet compression', () => {
    const archiver = new ParquetAuditArchiverService();
    const records = [
      { id: '1', ts: Date.parse('2026-03-01T10:00:00Z') },
      { id: '2', ts: Date.parse('2026-03-01T12:00:00Z') },
      { id: '3', ts: Date.parse('2026-03-02T10:00:00Z') },
    ];

    const parts = archiver.partition(records);
    assert.strictEqual(parts['2026-03-01'].length, 2);
    assert.strictEqual(parts['2026-03-02'].length, 1);
  });
});
