import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PreviewEnvOrchestratorService {
  constructor() { this.envs = new Map(); }
  provisionEnv(pr, ttl = 1000) {
    const e = { prNumber: pr, subdomain: 'pr-' + pr + '.preview.dev', createdAt: Date.now(), ttlMs: ttl };
    this.envs.set(pr, e);
    return e;
  }
  getExpiredEnvs(now) {
    const exp = [];
    for (const [pr, e] of this.envs.entries()) { if (now - e.createdAt > e.ttlMs) exp.push(pr); }
    return exp;
  }
}

describe('PreviewEnvOrchestratorService (Issue #1887)', () => {
  it('should provision isolated preview subdomains and harvest expired environments', () => {
    const orchestrator = new PreviewEnvOrchestratorService();
    const env = orchestrator.provisionEnv(100, 5000);
    assert.equal(env.subdomain, 'pr-100.preview.dev');

    assert.deepEqual(orchestrator.getExpiredEnvs(Date.now() + 1000), []);
    assert.deepEqual(orchestrator.getExpiredEnvs(Date.now() + 6000), [100]);
  });
});
