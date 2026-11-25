import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DependencyDegradationMonitorService } from './arch-svc-58.service.ts';

describe('DependencyDegradationMonitorService (ARCH-SVC-58)', () => {
  it('gracefully degrades specific feature flags when dependent services fail', () => {
    const monitor = new DependencyDegradationMonitorService(2);
    monitor.registerFeatureBinding('ai-autocomplete');

    assert.strictEqual(monitor.isFeatureEnabled('ai-autocomplete'), true);

    monitor.recordDependencyFailure('openai-api', 'ai-autocomplete');
    assert.strictEqual(monitor.isFeatureEnabled('ai-autocomplete'), true);

    const tripped = monitor.recordDependencyFailure('openai-api', 'ai-autocomplete');
    assert.strictEqual(tripped, true);
    assert.strictEqual(monitor.isFeatureEnabled('ai-autocomplete'), false);
  });
});
