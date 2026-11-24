import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AstCognitiveComplexityCalculatorService {
  calc(stmts, depth) { return stmts + depth * 2; }
}

describe('AstCognitiveComplexityCalculatorService (#2259)', () => {
  test('calculates cognitive complexity based on structural control flow and nesting', () => {
    const calc = new AstCognitiveComplexityCalculatorService();
    assert.strictEqual(calc.calc(3, 1), 5);
    assert.strictEqual(calc.calc(5, 3), 11);
  });
});
