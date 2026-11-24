import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TerraformDriftDetectorService {
  compareState(exp, act) {
    const drifted = [];
    for (const [k, v] of Object.entries(exp)) {
      if (act[k] === undefined || JSON.stringify(act[k]) !== JSON.stringify(v)) drifted.push(k);
    }
    return { hasDrift: drifted.length > 0, driftedKeys: drifted };
  }
}

describe('TerraformDriftDetectorService (Issue #1884)', () => {
  it('should compare declared IaC states against live cloud resources to flag drifts', () => {
    const detector = new TerraformDriftDetectorService();
    const exp = { 'aws_s3_bucket.logs': { versioning: true } };
    const act = { 'aws_s3_bucket.logs': { versioning: false } };

    const res = detector.compareState(exp, act);
    assert.equal(res.hasDrift, true);
    assert.deepEqual(res.driftedKeys, ['aws_s3_bucket.logs']);
  });
});
