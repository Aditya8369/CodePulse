import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MatchDisputeAdjudicatorService {
  adjudicate(c, s, v) {
    if (c !== s) return { upheld: false, reason: 'CLIENT_MISMATCH' };
    if (s !== v) return { upheld: false, reason: 'VALIDATOR_MISMATCH' };
    return { upheld: true };
  }
}

describe('MatchDisputeAdjudicatorService (Issue #1927)', () => {
  it('should adjudicate disputed battle outcomes against authoritative consensus', () => {
    const adjudicator = new MatchDisputeAdjudicatorService();
    assert.equal(adjudicator.adjudicate('win', 'win', 'win').upheld, true);
    assert.equal(adjudicator.adjudicate('win', 'loss', 'loss').upheld, false);
  });
});
