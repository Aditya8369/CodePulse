import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PostgresPartitionLifecycleService {
  generatePartitionName(t, y, m) { return t + '_y' + y + 'm' + String(m).padStart(2, '0'); }
  planPartitions(t, y, m, look = 2) {
    const planned = [];
    for (let i = 0; i <= look; i++) {
      let curM = m + i, curY = y;
      if (curM > 12) { curM -= 12; curY++; }
      planned.push(this.generatePartitionName(t, curY, curM));
    }
    return planned;
  }
}

describe('PostgresPartitionLifecycleService (Issue #1818)', () => {
  it('should plan monthly range partitions across year boundaries', () => {
    const lifecycle = new PostgresPartitionLifecycleService();
    const planned = lifecycle.planPartitions('audit_logs', 2026, 11, 2);
    assert.deepEqual(planned, ['audit_logs_y2026m11', 'audit_logs_y2026m12', 'audit_logs_y2027m01']);
  });
});
