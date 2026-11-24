import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildRoleRbacPoisonGuardService {
  constructor() {
    this.h = new Map();
    this.p = new Map();
  }
  setH(r, parents) { this.h.set(r, parents); }
  setP(r, perms) { this.p.set(r, new Set(perms)); }
  resolve(role) {
    const visited = new Set();
    const resolved = new Set();
    const traverse = (r) => {
      if (visited.has(r)) return;
      visited.add(r);
      const perms = this.p.get(r);
      if (perms) perms.forEach(p => resolved.add(p));
      const parents = this.h.get(r) || [];
      parents.forEach(traverse);
    };
    traverse(role);
    return new Set(resolved);
  }
}

describe('GuildRoleRbacPoisonGuardService (#2357)', () => {
  test('safely resolves inherited permissions without cyclic cache poisoning', () => {
    const guard = new GuildRoleRbacPoisonGuardService();
    guard.setP('MEMBER', ['READ']);
    guard.setP('OFFICER', ['WRITE']);
    guard.setP('LEADER', ['ADMIN']);

    guard.setH('OFFICER', ['MEMBER']);
    guard.setH('LEADER', ['OFFICER']);
    // Test cyclic loop defense
    guard.setH('MEMBER', ['LEADER']);

    const leaderPerms = guard.resolve('LEADER');
    assert.ok(leaderPerms.has('ADMIN'));
    assert.ok(leaderPerms.has('WRITE'));
    assert.ok(leaderPerms.has('READ'));
  });
});
