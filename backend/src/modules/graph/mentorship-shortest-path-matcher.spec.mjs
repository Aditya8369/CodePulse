import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MentorshipShortestPathMatcherService {
  match(req, candidates) {
    const el = candidates.filter(c => c.slots > 0 && req.some(s => c.skills.includes(s)));
    if (el.length === 0) return null;
    el.sort((a, b) => a.dist - b.dist);
    return el[0].id;
  }
}

describe('MentorshipShortestPathMatcherService (#2349)', () => {
  test('matches mentees to closest available mentor with matching skill competencies', () => {
    const matcher = new MentorshipShortestPathMatcherService();
    const candidates = [
      { id: 'm1', skills: ['NestJS', 'Kafka'], dist: 3, slots: 1 },
      { id: 'm2', skills: ['NestJS', 'Postgres'], dist: 1, slots: 2 },
      { id: 'm3', skills: ['Python'], dist: 1, slots: 3 },
    ];
    const best = matcher.match(['NestJS'], candidates);
    assert.strictEqual(best, 'm2'); // Closest distance (1) with matching skill
  });
});
