import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AntiSmurfVarianceDetectorService {
  check(winRate, apm, rank) {
    if (['BRONZE', 'SILVER'].includes(rank.toUpperCase()) && winRate >= 0.85 && apm >= 180) {
      return { suspect: true, confidence: 0.95 };
    }
    return { suspect: false, confidence: 0.1 };
  }
}

describe('AntiSmurfVarianceDetectorService (#2320)', () => {
  test('flags anomalous winrates and high APMs on novice accounts as smurf signatures', () => {
    const detector = new AntiSmurfVarianceDetectorService();
    const legit = detector.check(0.52, 90, 'BRONZE');
    assert.strictEqual(legit.suspect, false);

    const smurf = detector.check(0.92, 220, 'BRONZE');
    assert.strictEqual(smurf.suspect, true);
    assert.strictEqual(smurf.confidence, 0.95);
  });
});
