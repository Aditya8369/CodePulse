import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TerraformDriftContinuousVerifierService {
  diff(decl, live) {
    const drifted = Object.keys(decl).filter(k => decl[k] !== live[k]);
    return { hasDrift: drifted.length > 0, drifted };
  }
}

describe('TerraformDriftContinuousVerifierService (#2211)', () => {
  test('detects configuration drift between declared and live cloud states', () => {
    const verifier = new TerraformDriftContinuousVerifierService();
    const d1 = verifier.diff({ 'db.instance_type': 'db.r6g.xlarge' }, { 'db.instance_type': 'db.r6g.xlarge' });
    assert.strictEqual(d1.hasDrift, false);

    const d2 = verifier.diff({ 'db.instance_type': 'db.r6g.xlarge' }, { 'db.instance_type': 'db.t3.medium' });
    assert.strictEqual(d2.hasDrift, true);
    assert.strictEqual(d2.drifted[0], 'db.instance_type');
  });
});
