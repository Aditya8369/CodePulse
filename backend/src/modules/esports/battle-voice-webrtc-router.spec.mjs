import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BattleVoiceWebrtcRouterService {
  assign(team, role) {
    if (role === 'PLAYER') return { chan: `team-${team}`, speak: true, listen: true };
    if (role === 'COACH') return { chan: `team-${team}`, speak: false, listen: true };
    return { chan: 'audience', speak: false, listen: true };
  }
}

describe('BattleVoiceWebrtcRouterService (#2343)', () => {
  test('routes audio permissions according to team separation and role restrictions', () => {
    const router = new BattleVoiceWebrtcRouterService();
    const player = router.assign('alpha', 'PLAYER');
    assert.strictEqual(player.chan, 'team-alpha');
    assert.strictEqual(player.speak, true);

    const coach = router.assign('alpha', 'COACH');
    assert.strictEqual(coach.chan, 'team-alpha');
    assert.strictEqual(coach.speak, false); // Coaches restricted from speaking mid-round
  });
});
