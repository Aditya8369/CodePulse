import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EgressTrafficShaperService } from './arch-svc-81.service.ts';

describe('EgressTrafficShaperService (ARCH-SVC-81)', () => {
  it('shapes egress requests and enforces maximum requests per second ceilings', () => {
    const shaper = new EgressTrafficShaperService();
    shaper.setCeiling('api.github.com', 2);
    const now = 100000;

    assert.strictEqual(shaper.canSendEgressRequest('api.github.com', now), true);
    assert.strictEqual(shaper.canSendEgressRequest('api.github.com', now + 100), true);
    assert.strictEqual(shaper.canSendEgressRequest('api.github.com', now + 200), false);
    assert.strictEqual(shaper.canSendEgressRequest('api.github.com', now + 1200), true);
  });
});
