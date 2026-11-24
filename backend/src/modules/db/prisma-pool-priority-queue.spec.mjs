import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PrismaPoolPriorityQueueService {
  constructor() { this.q = { HIGH: [], LOW: [] }; }
  add(id, p) { this.q[p].push(id); }
  next() {
    if (this.q.HIGH.length > 0) return this.q.HIGH.shift();
    if (this.q.LOW.length > 0) return this.q.LOW.shift();
    return null;
  }
}

describe('PrismaPoolPriorityQueueService (#2137)', () => {
  test('prioritizes critical database transactions over background analytical queries', () => {
    const queue = new PrismaPoolPriorityQueueService();
    queue.add('analytics_job', 'LOW');
    queue.add('auth_login', 'HIGH');

    assert.strictEqual(queue.next(), 'auth_login');
    assert.strictEqual(queue.next(), 'analytics_job');
  });
});
