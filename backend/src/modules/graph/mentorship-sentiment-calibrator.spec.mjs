import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MentorshipSentimentCalibratorService {
  cal(stars, txt) {
    const t = txt.toLowerCase();
    const pos = ['great', 'helpful', 'excellent'].filter(w => t.includes(w)).length;
    const neg = ['bad', 'unhelpful', 'rude'].filter(w => t.includes(w)).length;
    const diff = pos - neg;
    let adj = stars;
    if (diff > 1 && stars < 5) adj = Math.min(5, stars + 0.5);
    if (diff < -1 && stars > 1) adj = Math.max(1, stars - 0.5);
    return { adj, diff };
  }
}

describe('MentorshipSentimentCalibratorService (#2370)', () => {
  test('adjusts feedback rating based on sentiment discrepancy', () => {
    const calibrator = new MentorshipSentimentCalibratorService();
    const res = calibrator.cal(3, 'Very helpful and great mentor with excellent advice!');
    assert.strictEqual(res.adj, 3.5);
    assert.strictEqual(res.diff, 3);
  });
});
