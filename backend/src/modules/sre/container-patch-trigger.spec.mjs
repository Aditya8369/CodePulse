import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ContainerPatchTriggerService {
  eval(tag, cves) {
    const hasCrit = cves.some(c => c.severity === 'CRITICAL');
    return { patch: hasCrit, rebuild: hasCrit };
  }
}

describe('ContainerPatchTriggerService (#2219)', () => {
  test('triggers automated base image rebuilds upon critical CVE detection', () => {
    const patcher = new ContainerPatchTriggerService();
    assert.strictEqual(patcher.eval('runner:v1', [{ severity: 'LOW' }]).rebuild, false);
    assert.strictEqual(patcher.eval('runner:v1', [{ severity: 'CRITICAL' }]).rebuild, true);
  });
});
