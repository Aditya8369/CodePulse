import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ProtobufConformanceLinterService {
  validateCompatibility(oldSchema, newSchema) {
    const violations = [];
    const oldMap = new Map(oldSchema.fields.map(f => [f.tagNumber, f]));
    const newMap = new Map(newSchema.fields.map(f => [f.tagNumber, f]));

    for (const [tag, oldF] of oldMap) {
      if (oldF.rule === 'required' && !newMap.has(tag)) {
        violations.push({ code: 'REQUIRED_FIELD_REMOVED', fieldTag: tag });
      }
    }
    for (const [tag, newF] of newMap) {
      if (oldMap.has(tag)) {
        const oldF = oldMap.get(tag);
        if (oldF.name !== newF.name) violations.push({ code: 'TAG_NUMBER_REUSED', fieldTag: tag });
        if (oldF.type !== newF.type) violations.push({ code: 'TYPE_MUTATION_INCOMPATIBLE', fieldTag: tag });
      }
    }
    return violations;
  }
}

describe('ProtobufConformanceLinterService (Issue #1799)', () => {
  it('should detect wire-breaking schema changes including tag reuse and removed required fields', () => {
    const linter = new ProtobufConformanceLinterService();
    const v1 = {
      version: '1.0.0',
      messageName: 'SubmissionEvent',
      fields: [
        { tagNumber: 1, name: 'submissionId', type: 'string', rule: 'required' },
        { tagNumber: 2, name: 'code', type: 'string' }
      ]
    };
    const v2Invalid = {
      version: '2.0.0',
      messageName: 'SubmissionEvent',
      fields: [
        // tag 1 removed!
        { tagNumber: 2, name: 'codeBuffer', type: 'bytes' } // tag 2 renamed & type mutated!
      ]
    };

    const violations = linter.validateCompatibility(v1, v2Invalid);
    assert.equal(violations.length, 3);
    assert.equal(violations.some(v => v.code === 'REQUIRED_FIELD_REMOVED'), true);
    assert.equal(violations.some(v => v.code === 'TAG_NUMBER_REUSED'), true);
    assert.equal(violations.some(v => v.code === 'TYPE_MUTATION_INCOMPATIBLE'), true);
  });
});
