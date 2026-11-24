import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KeystrokeMacroSignatureDetectorService {
  analyze(intervals) {
    if (intervals.length < 5) return { macro: false, stdDev: 99 };
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    return { macro: stdDev < 2.5, stdDev: Math.round(stdDev * 100) / 100 };
  }
}

describe('KeystrokeMacroSignatureDetectorService (#2325)', () => {
  test('flags robotic zero-variance keystroke intervals as automated macros', () => {
    const detector = new KeystrokeMacroSignatureDetectorService();
    // Human typing with natural variance
    const human = detector.analyze([85, 120, 95, 140, 110, 105]);
    assert.strictEqual(human.macro, false);
    assert.ok(human.stdDev > 10);

    // Machine/AutoHotkey macro with identical 50ms intervals
    const bot = detector.analyze([50, 50, 50, 50, 50, 50]);
    assert.strictEqual(bot.macro, true);
    assert.strictEqual(bot.stdDev, 0);
  });
});
