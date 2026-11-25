import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SandboxResourceGovernorService } from './arch-svc-74.service.ts';

describe('SandboxResourceGovernorService (ARCH-SVC-74)', () => {
  it('throttles executions entering peak load and reserves headroom for high-priority submissions', () => {
    const governor = new SandboxResourceGovernorService(2, 0.5);

    const s1 = governor.requestSandboxSlot('NORMAL');
    assert.strictEqual(s1.granted, true);
    assert.strictEqual(s1.throttled, false);

    const s2 = governor.requestSandboxSlot('NORMAL');
    assert.strictEqual(s2.granted, true);
    assert.strictEqual(s2.throttled, true);

    // Saturated: normal rejected, high granted
    const sNormal = governor.requestSandboxSlot('NORMAL');
    assert.strictEqual(sNormal.granted, false);

    const sHigh = governor.requestSandboxSlot('HIGH');
    assert.strictEqual(sHigh.granted, true);
  });
});
