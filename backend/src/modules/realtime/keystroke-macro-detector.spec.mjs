import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KeystrokeMacroDetectorService {
  constructor() { this.clients = new Map(); }
  record(id, ts) {
    const l = this.clients.get(id) || [];
    l.push(ts);
    this.clients.set(id, l);
    if (l.length < 5) return { isMacro: false };
    const diffs = [];
    for (let i = 1; i < l.length; i++) diffs.push(l[i] - l[i-1]);
    const mean = diffs.reduce((a,b)=>a+b,0)/diffs.length;
    const isMacro = diffs.every(d => Math.abs(d - mean) < 1);
    return { isMacro };
  }
}

describe('KeystrokeMacroDetectorService (#2121)', () => {
  test('flags synthetic script keystroke injections with robotic timing uniformity', () => {
    const detector = new KeystrokeMacroDetectorService();
    // Simulate robotic exactly 10ms intervals
    for (let i = 0; i < 6; i++) {
      const res = detector.record('bot-1', 1000 + i * 10);
      if (i === 5) assert.strictEqual(res.isMacro, true);
    }
  });
});
