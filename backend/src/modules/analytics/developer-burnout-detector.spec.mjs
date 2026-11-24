import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DeveloperBurnoutDetectorService {
  evaluateFatigue(ratio, hrs) {
    if (hrs > 60 || ratio > 0.4) return { risk: 'HIGH' };
    if (hrs > 45 || ratio > 0.2) return { risk: 'MEDIUM' };
    return { risk: 'LOW' };
  }
}

describe('DeveloperBurnoutDetectorService (Issue #1939)', () => {
  it('should detect developer burnout risks from late-night commits and excessive hours', () => {
    const detector = new DeveloperBurnoutDetectorService();
    assert.equal(detector.evaluateFatigue(0.1, 40).risk, 'LOW');
    assert.equal(detector.evaluateFatigue(0.3, 40).risk, 'MEDIUM');
    assert.equal(detector.evaluateFatigue(0.5, 65).risk, 'HIGH');
  });
});
