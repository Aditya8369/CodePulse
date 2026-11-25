import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DomainEventVersioningService } from './arch-svc-36.service.ts';

describe('DomainEventVersioningService (ARCH-SVC-36)', () => {
  it('progressively upcasts historical event schemas to the latest schema version', () => {
    const service = new DomainEventVersioningService();

    // V1 -> V2: rename user_id to userId
    service.registerUpcaster('UserCreated', 1, (payload) => ({
      userId: payload.user_id,
      email: payload.email,
    }));

    // V2 -> V3: add emailVerified: false default
    service.registerUpcaster('UserCreated', 2, (payload) => ({
      ...payload,
      emailVerified: false,
    }));

    const v1Event = {
      eventType: 'UserCreated',
      version: 1,
      payload: { user_id: 'u-1', email: 'test@example.com' },
    };

    const upcasted = service.upcastEvent(v1Event, 3);
    assert.strictEqual(upcasted.version, 3);
    assert.deepStrictEqual(upcasted.payload, {
      userId: 'u-1',
      email: 'test@example.com',
      emailVerified: false,
    });
  });
});
