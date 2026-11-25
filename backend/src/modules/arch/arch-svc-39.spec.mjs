import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OperationalTransformationService } from './arch-svc-39.service.ts';

describe('OperationalTransformationService (ARCH-SVC-39)', () => {
  it('transforms concurrent insert operations to maintain convergence', () => {
    const ot = new OperationalTransformationService();
    const base = 'Hello World';

    // Op1 inserts ' Dear' at pos 5
    const op1 = { type: 'INSERT', position: 5, text: ' Dear' };
    // Op2 inserts '!' at pos 11
    const op2 = { type: 'INSERT', position: 11, text: '!' };

    const [transformed1, transformed2] = ot.transform(op1, op2);

    const res1 = ot.apply(ot.apply(base, op1), transformed2);
    assert.strictEqual(res1, 'Hello Dear World!');
  });
});
