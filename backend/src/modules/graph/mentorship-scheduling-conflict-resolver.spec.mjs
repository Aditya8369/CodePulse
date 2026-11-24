import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MentorshipSchedulingConflictResolverService {
  constructor() { this.slots = []; }
  book(s) {
    const overlap = this.slots.some(
      x => x.m === s.m && Math.max(x.start, s.start) < Math.min(x.end, s.end)
    );
    if (overlap) return false;
    this.slots.push(s);
    return true;
  }
}

describe('MentorshipSchedulingConflictResolverService (#2363)', () => {
  test('rejects concurrent overlapping booking slots for the same mentor', () => {
    const resolver = new MentorshipSchedulingConflictResolverService();
    assert.strictEqual(resolver.book({ m: 'mentor-1', start: 1000, end: 2000 }), true);
    assert.strictEqual(resolver.book({ m: 'mentor-1', start: 1500, end: 2500 }), false); // Overlaps
    assert.strictEqual(resolver.book({ m: 'mentor-1', start: 2000, end: 3000 }), true); // Back-to-back ok
  });
});
