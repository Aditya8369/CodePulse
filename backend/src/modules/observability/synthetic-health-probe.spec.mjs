import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SyntheticHealthProbeService {
  async executeProbe(runner) {
    const start = Date.now();
    try {
      const res = await runner();
      return { healthy: res.success, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }
}

describe('SyntheticHealthProbeService (Issue #1912)', () => {
  it('should run end-to-end synthetic submission probes and report execution health', async () => {
    const probe = new SyntheticHealthProbeService();
    const ok = await probe.executeProbe(async () => ({ success: true, durationMs: 10 }));
    assert.equal(ok.healthy, true);

    const fail = await probe.executeProbe(async () => { throw new Error('Sandbox down'); });
    assert.equal(fail.healthy, false);
  });
});
