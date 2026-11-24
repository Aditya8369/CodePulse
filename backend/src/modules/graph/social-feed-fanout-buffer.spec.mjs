import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SocialFeedFanoutBufferService {
  constructor() { this.inboxes = new Map(); }
  fanOut(act, followers) {
    followers.forEach(f => {
      if (!this.inboxes.has(f)) this.inboxes.set(f, []);
      const box = this.inboxes.get(f);
      box.unshift(act);
      if (box.length > 3) box.pop(); // sliding window of 3 for testing
    });
  }
  get(f) { return this.inboxes.get(f) || []; }
}

describe('SocialFeedFanoutBufferService (#2365)', () => {
  test('fans out activities across follower inboxes with bounded sliding window', () => {
    const buffer = new SocialFeedFanoutBufferService();
    const followers = ['user1', 'user2'];

    buffer.fanOut({ id: 'a1', content: 'hello' }, followers);
    buffer.fanOut({ id: 'a2', content: 'world' }, followers);
    buffer.fanOut({ id: 'a3', content: 'foo' }, followers);
    buffer.fanOut({ id: 'a4', content: 'bar' }, followers);

    const inbox = buffer.get('user1');
    assert.strictEqual(inbox.length, 3);
    assert.strictEqual(inbox[0].id, 'a4');
    assert.strictEqual(inbox[2].id, 'a2');
  });
});
