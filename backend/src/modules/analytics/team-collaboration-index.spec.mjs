import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TeamCollaborationIndexService {
  calculateIndex(reviewHrs, velocity) {
    const r = Math.max(0, 50 - reviewHrs);
    const v = Math.min(50, velocity * 10);
    return Math.min(100, Math.round(r + v));
  }
}

describe('TeamCollaborationIndexService (Issue #1938)', () => {
  it('should compute collaboration health index based on review turnaround and velocity', () => {
    const indexer = new TeamCollaborationIndexService();
    const score = indexer.calculateIndex(5, 4); // 45 + 40 = 85
    assert.equal(score, 85);
  });
});
