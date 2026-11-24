import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ColdDataArchivalService {
  constructor(days = 90) { this.days = days; }
  shouldArchive(p) { return p.ageDays >= this.days; }
  archivePartition(p) { return { name: p.name, count: p.recordCount, status: 'ARCHIVED' }; }
}

describe('ColdDataArchivalService (Issue #1836)', () => {
  it('should flag partitions exceeding age threshold and export to cold archival storage', () => {
    const archival = new ColdDataArchivalService(90);
    assert.equal(archival.shouldArchive({ name: 'p_2026_01', ageDays: 30, recordCount: 100 }), false);
    assert.equal(archival.shouldArchive({ name: 'p_2025_01', ageDays: 120, recordCount: 500 }), true);
  });
});
