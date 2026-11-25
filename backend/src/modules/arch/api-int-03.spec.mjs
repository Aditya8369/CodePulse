import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WebhookDeliveryEngineService } from './api-int-03.service.ts';

describe('WebhookDeliveryEngineService (API-INT-03)', () => {
  it('retries failed webhooks and escalates exhausted deliveries to Dead-Letter Queue', () => {
    const engine = new WebhookDeliveryEngineService(2);
    engine.enqueueWebhook('wh-1', 'https://client.io/hook', { event: 'PAY' });

    engine.recordFailure('wh-1');
    assert.strictEqual(engine.getDlqTasks().length, 0);

    engine.recordFailure('wh-1');
    assert.strictEqual(engine.getDlqTasks().length, 1);
    assert.strictEqual(engine.getDlqTasks()[0].id, 'wh-1');
  });
});
