import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CognitiveLoadReviewCalculatorService {
  load(files, hunks, dels) {
    return Math.round((files * 1.5 + hunks * 0.8 + dels * 0.1) * 10) / 10;
  }
}

describe('CognitiveLoadReviewCalculatorService (#2285)', () => {
  test('calculates developer cognitive review load based on structural patch dispersion', () => {
    const calc = new CognitiveLoadReviewCalculatorService();
    assert.strictEqual(calc.load(4, 10, 50), 19);
  });
});
