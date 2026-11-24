import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class Neo4jMentorshipMatcherService {
  findBestMentor(needed, mentors) {
    let b = null; let max = 0;
    for (const m of mentors) {
      const cnt = m.skills.filter(s => needed.includes(s)).length;
      if (cnt > max) { max = cnt; b = m; }
    }
    return b;
  }
}

describe('Neo4jMentorshipMatcherService (Issue #1933)', () => {
  it('should find optimal mentorship matches based on overlapping skill proficiencies', () => {
    const matcher = new Neo4jMentorshipMatcherService();
    const mentors = [
      { id: 'm1', skills: ['Python', 'Docker'] },
      { id: 'm2', skills: ['TypeScript', 'NestJS', 'GraphQL'] }
    ];

    const match = matcher.findBestMentor(['TypeScript', 'GraphQL'], mentors);
    assert.equal(match?.id, 'm2');
  });
});
