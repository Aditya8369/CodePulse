import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CollaborationIndexService {
  computeIndex(activities) {
    const byReviewer = new Map();
    for (const a of activities) {
      const list = byReviewer.get(a.reviewerId) || [];
      list.push(a);
      byReviewer.set(a.reviewerId, list);
    }
    const map = new Map();
    for (const [id, acts] of byReviewer.entries()) {
      const count = acts.length;
      const avgT = acts.reduce((s, a) => s + a.turnaroundHours, 0) / count;
      const cross = acts.filter(a => a.reviewerTeam !== a.authorTeam).length / count;
      const avgC = acts.reduce((s, a) => s + a.commentCount, 0) / count;
      let tScore = avgT <= 4 ? 40 : (avgT <= 24 ? 25 : 10);
      let cScore = Math.min(30, Math.round(cross * 30));
      let cmScore = Math.min(30, Math.round(avgC * 5));
      const score = Math.min(100, tScore + cScore + cmScore);
      map.set(id, { score, reviewCount: count, badge: score >= 80 ? 'Peer Champion' : 'Collaborator' });
    }
    return map;
  }
}

describe('CollaborationIndexService (Issue #1454)', () => {
  it('should award Peer Champion badge for fast turnaround and in-depth reviews', () => {
    const service = new CollaborationIndexService();
    const data = [
      { reviewerId: 'u1', authorId: 'u2', reviewerTeam: 'backend', authorTeam: 'frontend', turnaroundHours: 2, commentCount: 5 },
      { reviewerId: 'u1', authorId: 'u3', reviewerTeam: 'backend', authorTeam: 'mobile', turnaroundHours: 3, commentCount: 6 }
    ];
    const map = service.computeIndex(data);
    const u1 = map.get('u1');
    assert.ok(u1.score >= 80);
    assert.equal(u1.badge, 'Peer Champion');
  });
});
