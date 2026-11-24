import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LockstepSyncValidatorService {
  validateTurn(cur, turn, prevHash) {
    if (turn.turnIndex !== cur + 1) return false;
    return turn.expectedStateHash === prevHash;
  }
}

describe('LockstepSyncValidatorService (Issue #1916)', () => {
  it('should enforce turn monotonic progression and state hash consistency', () => {
    const validator = new LockstepSyncValidatorService();
    const validTurn = { turnIndex: 2, playerActionHash: 'act1', expectedStateHash: 'hash-state-1' };
    assert.equal(validator.validateTurn(1, validTurn, 'hash-state-1'), true);
    assert.equal(validator.validateTurn(1, validTurn, 'tampered-hash'), false);
    assert.equal(validator.validateTurn(3, validTurn, 'hash-state-1'), false);
  });
});
