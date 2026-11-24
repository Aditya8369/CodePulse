import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildInactivityDemotionEngineService {
  demote(members) {
    const d = [];
    members.forEach(m => {
      if (m.role === 'OFFICER' && m.days > 30) d.push({ id: m.id, from: 'OFFICER', to: 'VETERAN' });
      else if (m.role === 'VETERAN' && m.days > 60) d.push({ id: m.id, from: 'VETERAN', to: 'MEMBER' });
    });
    return d;
  }
}

describe('GuildInactivityDemotionEngineService (#2359)', () => {
  test('flags inactive guild members for stepped tier demotion', () => {
    const engine = new GuildInactivityDemotionEngineService();
    const members = [
      { id: 'm1', role: 'OFFICER', days: 35 },
      { id: 'm2', role: 'OFFICER', days: 10 },
      { id: 'm3', role: 'VETERAN', days: 65 }
    ];
    const demotions = engine.demote(members);
    assert.strictEqual(demotions.length, 2);
    assert.strictEqual(demotions[0].id, 'm1');
    assert.strictEqual(demotions[0].to, 'VETERAN');
    assert.strictEqual(demotions[1].id, 'm3');
    assert.strictEqual(demotions[1].to, 'MEMBER');
  });
});
