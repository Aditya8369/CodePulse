import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CgroupsV2PressureGuardService {
  eval(psi) {
    if (psi.fullAvg10 > 20 || psi.someAvg10 > 50) return { action: 'EMERGENCY_SHED', shedRatio: 0.8 };
    if (psi.someAvg10 > 15) return { action: 'THROTTLE_BACKGROUND', shedRatio: 0.3 };
    return { action: 'NONE', shedRatio: 0.0 };
  }
}

describe('CgroupsV2PressureGuardService (#2198)', () => {
  test('evaluates cgroups v2 memory PSI stalls and sheds load', () => {
    const guard = new CgroupsV2PressureGuardService();
    assert.strictEqual(guard.eval({ someAvg10: 5, fullAvg10: 0 }).action, 'NONE');
    assert.strictEqual(guard.eval({ someAvg10: 25, fullAvg10: 2 }).action, 'THROTTLE_BACKGROUND');
    assert.strictEqual(guard.eval({ someAvg10: 60, fullAvg10: 25 }).action, 'EMERGENCY_SHED');
  });
});
