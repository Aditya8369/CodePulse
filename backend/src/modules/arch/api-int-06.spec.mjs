import { describe, it } from 'node:test';
import assert from 'node:assert';
import { IdempotencyKeyMiddlewareService } from './api-int-06.service.ts';

describe('IdempotencyKeyMiddlewareService (API-INT-06)', () => {
  it('deduplicates mutate requests matching identical idempotency keys', () => {
    const middleware = new IdempotencyKeyMiddlewareService();
    let executions = 0;

    const run = () => middleware.processRequest('idem-key-1', () => {
      executions++;
      return { statusCode: 201, responseBody: { created: true } };
    });

    const r1 = run();
    assert.strictEqual(r1.cached, false);
    assert.strictEqual(executions, 1);

    const r2 = run();
    assert.strictEqual(r2.cached, true);
    assert.strictEqual(executions, 1);
  });
});
