import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CodeReviewTurnaroundForecasterService {
  forecast(lines, revs) {
    return Math.round((4.0 + (lines / 100) * 2) * (revs > 0 ? 1/revs : 1) * 10) / 10;
  }
}

describe('CodeReviewTurnaroundForecasterService (#2263)', () => {
  test('estimates pull request review turnaround velocity based on diff size and reviewers', () => {
    const forecaster = new CodeReviewTurnaroundForecasterService();
    const h1 = forecaster.forecast(200, 1);
    assert.strictEqual(h1, 8);
    const h2 = forecaster.forecast(200, 2);
    assert.strictEqual(h2, 4);
  });
});
