import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KeystrokeVelocityAnalyzerService {
  analyzeIntervals(intervals) {
    if (intervals.length < 5) return { isMacroDetected: false };
    const mean = intervals.reduce((a,b)=>a+b,0)/intervals.length;
    const variance = intervals.reduce((s,v)=>s+Math.pow(v-mean,2),0)/intervals.length;
    return { isMacroDetected: variance < 2.0 && mean < 15.0, variance };
  }
}

describe('KeystrokeVelocityAnalyzerService (Issue #1922)', () => {
  it('should detect synthetic macro pastes with robotic near-zero inter-key variance', () => {
    const analyzer = new KeystrokeVelocityAnalyzerService();
    assert.equal(analyzer.analyzeIntervals([5, 5, 5, 5, 5, 5]).isMacroDetected, true);
    assert.equal(analyzer.analyzeIntervals([120, 85, 210, 45, 160]).isMacroDetected, false);
  });
});
