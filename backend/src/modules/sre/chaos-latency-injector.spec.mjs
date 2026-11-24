import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ChaosLatencyInjectorService {
  constructor() { this.config = { enabled: false, prob: 0.1, latencyMs: 20, maxBlast: 0.1 }; }
  configure(c) { this.config = { ...this.config, ...c }; }
  async maybeInjectFault() {
    if (!this.config.enabled) return false;
    await new Promise(r => setTimeout(r, this.config.latencyMs));
    return true;
  }
}

describe('ChaosLatencyInjectorService (Issue #1875)', () => {
  it('should inject synthetic latency when enabled and respect disabled bypass', async () => {
    const chaos = new ChaosLatencyInjectorService();
    assert.equal(await chaos.maybeInjectFault(), false);

    chaos.configure({ enabled: true, latencyMs: 15 });
    const start = Date.now();
    const injected = await chaos.maybeInjectFault();
    assert.equal(injected, true);
    assert.ok(Date.now() - start >= 10);
  });
});
