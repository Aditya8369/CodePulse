import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DeveloperBurnoutDetectorService {
  evaluate(devId, commits) {
    if (!commits.length) return { score: 0, level: 'LOW' };
    let late = 0, wk = 0;
    commits.forEach(c => {
      if (c.hour >= 22 || c.hour <= 5) late++;
      const d = new Date(c.timestamp).getDay();
      if (d === 0 || d === 6) wk++;
    });
    const s = Math.min(1, (late / commits.length) * 0.6 + (wk / commits.length) * 0.4);
    let lvl = 'LOW';
    if (s >= 0.75) lvl = 'CRITICAL';
    else if (s >= 0.5) lvl = 'HIGH';
    else if (s >= 0.25) lvl = 'MODERATE';
    return { score: Math.round(s * 100) / 100, level: lvl };
  }
}

describe('DeveloperBurnoutDetectorService (#2356)', () => {
  test('flags high burnout risk for excessive late-night and weekend commits', () => {
    const detector = new DeveloperBurnoutDetectorService();
    const commits = [
      { timestamp: '2026-03-07T23:30:00Z', hour: 23 }, // Saturday night
      { timestamp: '2026-03-08T01:00:00Z', hour: 1 },  // Sunday night
      { timestamp: '2026-03-08T03:00:00Z', hour: 3 },  // Sunday morning
      { timestamp: '2026-03-09T23:00:00Z', hour: 23 }  // Monday night
    ];
    const res = detector.evaluate('dev-101', commits);
    assert.strictEqual(res.level, 'CRITICAL');
    assert.ok(res.score >= 0.75);
  });
});
