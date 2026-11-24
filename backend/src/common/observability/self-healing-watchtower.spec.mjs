import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SelfHealingWatchtowerService {
  constructor(scanIntervalMs = 2000) {
    this.circuits = new Map();
    this.auditLog = [];
  }

  registerService(name, probe, failureThreshold = 3) {
    this.circuits.set(name, {
      state: 'CLOSED',
      failures: 0,
      failureThreshold,
      lastStateChange: Date.now(),
      probe
    });
  }

  recordFailure(name) {
    const circuit = this.circuits.get(name);
    if (!circuit) return;
    circuit.failures++;
    if (circuit.failures >= circuit.failureThreshold && circuit.state === 'CLOSED') {
      this.transition(name, 'OPEN', 'Failure threshold exceeded');
    }
  }

  recordSuccess(name) {
    const circuit = this.circuits.get(name);
    if (!circuit) return;
    circuit.failures = 0;
    if (circuit.state === 'HALF_OPEN') {
      this.transition(name, 'CLOSED', 'Canary probe succeeded');
    }
  }

  transition(name, toState, reason) {
    const circuit = this.circuits.get(name);
    if (!circuit) return;
    const fromState = circuit.state;
    circuit.state = toState;
    circuit.lastStateChange = Date.now();
    this.auditLog.push({ serviceName: name, fromState, toState, timestamp: Date.now(), reason });
  }

  async runCanaryProbes() {
    for (const [name, circuit] of this.circuits.entries()) {
      if (circuit.state === 'OPEN') {
        this.transition(name, 'HALF_OPEN', 'Canary probe check');
        try {
          const healthy = await circuit.probe();
          if (healthy) {
            this.recordSuccess(name);
          } else {
            this.transition(name, 'OPEN', 'Canary probe failed');
          }
        } catch {
          this.transition(name, 'OPEN', 'Canary probe threw');
        }
      }
    }
  }

  getCircuitState(name) {
    return this.circuits.get(name)?.state ?? null;
  }

  getAuditLog() {
    return [...this.auditLog];
  }
}

describe('SelfHealingWatchtowerService (Issue #1479)', () => {
  it('should trip circuit breaker to OPEN when failure threshold is exceeded', () => {
    const watchtower = new SelfHealingWatchtowerService();
    watchtower.registerService('payment-gateway', async () => true, 2);

    assert.equal(watchtower.getCircuitState('payment-gateway'), 'CLOSED');
    watchtower.recordFailure('payment-gateway');
    assert.equal(watchtower.getCircuitState('payment-gateway'), 'CLOSED');
    watchtower.recordFailure('payment-gateway');
    assert.equal(watchtower.getCircuitState('payment-gateway'), 'OPEN');
  });

  it('should autonomously heal service via canary probe and transition back to CLOSED', async () => {
    let serviceUp = false;
    const watchtower = new SelfHealingWatchtowerService();
    watchtower.registerService('leaderboard-db', async () => serviceUp, 1);

    watchtower.recordFailure('leaderboard-db');
    assert.equal(watchtower.getCircuitState('leaderboard-db'), 'OPEN');

    // Upstream recovers
    serviceUp = true;
    await watchtower.runCanaryProbes();

    assert.equal(watchtower.getCircuitState('leaderboard-db'), 'CLOSED');
    const log = watchtower.getAuditLog();
    assert.ok(log.length >= 3);
    assert.equal(log[log.length - 1].toState, 'CLOSED');
  });
});
