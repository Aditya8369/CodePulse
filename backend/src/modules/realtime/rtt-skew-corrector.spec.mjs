import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RttSkewCorrectorService {
  constructor() { this.pings = new Map(); }
  record(id, raw) {
    const l = this.pings.get(id) || [];
    l.push(raw);
    this.pings.set(id, l);
    const s = [...l].sort((a,b)=>a-b);
    const med = s[Math.floor(s.length/2)];
    if (raw > med * 3) return Math.round(med * 1.5);
    return raw;
  }
}

describe('RttSkewCorrectorService (#2129)', () => {
  test('dampens sudden Wi-Fi/cellular ping spikes using median window filtering', () => {
    const corrector = new RttSkewCorrectorService();
    corrector.record('c1', 30);
    corrector.record('c1', 32);
    corrector.record('c1', 31);

    // Sudden 500ms outlier ping
    const corrected = corrector.record('c1', 500);
    assert.strictEqual(corrected < 100, true);
    assert.strictEqual(corrected, 48);
  });
});
