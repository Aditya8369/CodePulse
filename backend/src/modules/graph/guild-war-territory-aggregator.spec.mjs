import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildWarTerritoryAggregatorService {
  constructor() { this.s = new Map(); }
  score(sector, guild, pts) {
    let m = this.s.get(sector) || new Map();
    this.s.set(sector, m);
    m.set(guild, (m.get(guild) || 0) + pts);
    let topG = '', topP = -1;
    for (const [g, p] of m.entries()) {
      if (p > topP) { topP = p; topG = g; }
    }
    return { topG, topP };
  }
}

describe('GuildWarTerritoryAggregatorService (#2353)', () => {
  test('tracks sector domination points and resolves leading guild factions', () => {
    const war = new GuildWarTerritoryAggregatorService();
    war.score('sector-north', 'guild-a', 50);
    const lead = war.score('sector-north', 'guild-b', 80);
    assert.strictEqual(lead.topG, 'guild-b');
    assert.strictEqual(lead.topP, 80);
  });
});
