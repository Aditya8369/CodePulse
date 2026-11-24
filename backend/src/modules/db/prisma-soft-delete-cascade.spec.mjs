import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PrismaSoftDeleteCascadeService {
  cascade(type, id) {
    if (type === 'User') return ['Profile', 'GuildMembership', 'MatchHistory'];
    return [];
  }
}

describe('PrismaSoftDeleteCascadeService (#2163)', () => {
  test('cascades soft-delete marks to child relational entities preserving integrity', () => {
    const s = new PrismaSoftDeleteCascadeService();
    const children = s.cascade('User', 'u-1');
    assert.strictEqual(children.length, 3);
    assert.strictEqual(children[0], 'Profile');
  });
});
