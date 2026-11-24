import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SkillHalflifeDecayModelerService {
  calc(init, days, halfLife = 365) {
    if (days <= 0) return init;
    return Math.round(init * Math.pow(0.5, days / halfLife) * 10) / 10;
  }
}

describe('SkillHalflifeDecayModelerService (#2351)', () => {
  test('models technical skill retention decay using exponential half-life formulas', () => {
    const modeler = new SkillHalflifeDecayModelerService();
    assert.strictEqual(modeler.calc(100, 0, 365), 100);
    assert.strictEqual(modeler.calc(100, 365, 365), 50); // Exactly half after 365 days
    assert.strictEqual(modeler.calc(100, 730, 365), 25); // Quarter after 2 half-lives
  });
});
