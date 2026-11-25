import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AmqpBaggagePropagatorService } from './arch-svc-76.service.ts';

describe('AmqpBaggagePropagatorService (ARCH-SVC-76)', () => {
  it('serializes and deserializes W3C baggage headers over AMQP message metadata', () => {
    const prop = new AmqpBaggagePropagatorService();
    const headers = prop.injectBaggage({}, { tenantId: 't-123', region: 'us-east' });

    const extracted = prop.extractBaggage(headers);
    assert.deepStrictEqual(extracted, { tenantId: 't-123', region: 'us-east' });
  });
});
