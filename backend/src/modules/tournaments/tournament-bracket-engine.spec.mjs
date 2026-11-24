import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TournamentBracketEngineService {
  generateSingleEliminationRound1(players) {
    const p = [];
    for (let i = 0; i < players.length / 2; i++) p.push([players[i], players[players.length - 1 - i]]);
    return p;
  }
}

describe('TournamentBracketEngineService (Issue #1929)', () => {
  it('should seed round 1 single elimination brackets pairing top seeds with bottom seeds', () => {
    const engine = new TournamentBracketEngineService();
    const players = ['seed-1', 'seed-2', 'seed-3', 'seed-4'];
    const pairings = engine.generateSingleEliminationRound1(players);

    assert.deepEqual(pairings, [
      ['seed-1', 'seed-4'],
      ['seed-2', 'seed-3']
    ]);
  });
});
