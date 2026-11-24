import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ConfigHotReloadEngineService {
  constructor() { this.store = new Map(); this.l = []; }
  updateKey(k, v) { this.store.set(k, v); this.l.forEach(fn => fn(k, v)); }
  getKey(k, d) { return this.store.has(k) ? this.store.get(k) : d; }
  onChange(fn) { this.l.push(fn); }
}

describe('ConfigHotReloadEngineService (Issue #1888)', () => {
  it('should propagate live configuration updates without requiring application restarts', () => {
    const config = new ConfigHotReloadEngineService();
    let triggeredKey = null;
    config.onChange((k, v) => { triggeredKey = k; });

    config.updateKey('MATCHMAKING_RATE_LIMIT', 500);
    assert.equal(config.getKey('MATCHMAKING_RATE_LIMIT'), 500);
    assert.equal(triggeredKey, 'MATCHMAKING_RATE_LIMIT');
  });
});
