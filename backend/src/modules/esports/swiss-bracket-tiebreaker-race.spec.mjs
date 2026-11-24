import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SwissBracketTiebreakerRaceService {
  sort(scores) {
    return [...scores].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
      if (b.sonnebornBergerScore !== a.sonnebornBergerScore) return b.sonnebornBergerScore - a.sonnebornBergerScore;
      return a.id.localeCompare(b.id);
    });
  }
}

describe('SwissBracketTiebreakerRaceService (#2316)', () => {
  test('breaks ties deterministically using Buchholz and Sonneborn-Berger coefficients', () => {
    const service = new SwissBracketTiebreakerRaceService();
    const scores = [
      { id: 'p2', wins: 3, buchholzScore: 12, sonnebornBergerScore: 6 },
      { id: 'p1', wins: 3, buchholzScore: 14, sonnebornBergerScore: 8 },
      { id: 'p3', wins: 2, buchholzScore: 15, sonnebornBergerScore: 4 },
    ];

    const sorted = service.sort(scores);
    assert.strictEqual(sorted[0].id, 'p1'); // 3 wins, 14 Buchholz
    assert.strictEqual(sorted[1].id, 'p2'); // 3 wins, 12 Buchholz
    assert.strictEqual(sorted[2].id, 'p3'); // 2 wins
  });
});
