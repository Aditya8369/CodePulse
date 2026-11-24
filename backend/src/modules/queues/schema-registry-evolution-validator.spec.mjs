import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SchemaRegistryEvolutionValidatorService {
  validate(prev, next, mode = 'BACKWARD') {
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    if (mode === 'BACKWARD') {
      const missing = prev.filter(f => !nextSet.has(f));
      return { ok: missing.length === 0, diff: missing };
    }
    return { ok: true, diff: [] };
  }
}

describe('SchemaRegistryEvolutionValidatorService (#2315)', () => {
  test('enforces backward compatibility on evolving Kafka event schemas', () => {
    const val = new SchemaRegistryEvolutionValidatorService();
    const v1 = ['id', 'user', 'amount'];
    const v2Good = ['id', 'user', 'amount', 'currency']; // added field is backward compatible
    const v2Bad = ['id', 'user']; // dropped amount is not backward compatible

    assert.strictEqual(val.validate(v1, v2Good).ok, true);
    assert.strictEqual(val.validate(v1, v2Bad).ok, false);
    assert.deepStrictEqual(val.validate(v1, v2Bad).diff, ['amount']);
  });
});
