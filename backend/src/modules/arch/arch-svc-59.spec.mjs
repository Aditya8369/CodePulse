import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SchemaEvolutionValidatorService } from './arch-svc-59.service.ts';

describe('SchemaEvolutionValidatorService (ARCH-SVC-59)', () => {
  it('approves backward-compatible schema evolutions with optional fields', () => {
    const validator = new SchemaEvolutionValidatorService();
    const oldSchema = {
      version: 1,
      fields: [{ name: 'id', type: 'string', required: true }]
    };
    const newSchema = {
      version: 2,
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'bio', type: 'string', required: false }
      ]
    };

    assert.strictEqual(validator.validateBackwardCompatibility(oldSchema, newSchema).compatible, true);
  });

  it('rejects breaking changes that introduce required fields without defaults', () => {
    const validator = new SchemaEvolutionValidatorService();
    const oldSchema = {
      version: 1,
      fields: [{ name: 'id', type: 'string', required: true }]
    };
    const brokenSchema = {
      version: 2,
      fields: [
        { name: 'id', type: 'string', required: true },
        { name: 'taxId', type: 'string', required: true }
      ]
    };

    const res = validator.validateBackwardCompatibility(oldSchema, brokenSchema);
    assert.strictEqual(res.compatible, false);
    assert.ok(res.reason?.includes('taxId'));
  });
});
