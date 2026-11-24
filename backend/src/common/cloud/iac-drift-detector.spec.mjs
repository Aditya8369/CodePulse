import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class IacDriftDetectorService {
  compareState(gitHcl, live) {
    const gitMap = new Map(gitHcl.map(r => [r.address, r]));
    const liveMap = new Map(live.map(r => [r.address, r]));
    const unmanaged = [];
    const missing = [];
    const modified = [];

    for (const [addr] of liveMap) {
      if (!gitMap.has(addr)) unmanaged.push(addr);
    }
    for (const [addr, gitRes] of gitMap) {
      if (!liveMap.has(addr)) { missing.push(addr); continue; }
      const liveRes = liveMap.get(addr);
      for (const [k, v] of Object.entries(gitRes.attributes)) {
        if (JSON.stringify(v) !== JSON.stringify(liveRes.attributes[k])) {
          modified.push({ address: addr, attribute: k, expected: v, actual: liveRes.attributes[k] });
        }
      }
    }
    return { hasDrift: unmanaged.length > 0 || missing.length > 0 || modified.length > 0, unmanaged, missing, modified };
  }
}

describe('IacDriftDetectorService (Issue #1438)', () => {
  it('should detect unauthorized console modification drift and unmanaged resources', () => {
    const detector = new IacDriftDetectorService();
    const gitState = [
      { address: 'aws_security_group.db_sg', type: 'aws_security_group', attributes: { ingress_port: 5432, cidr: '10.0.0.0/16' } },
      { address: 'aws_s3_bucket.telemetry', type: 'aws_s3_bucket', attributes: { versioning: true } }
    ];

    const liveState = [
      // Modified attribute in console (port opened to 0.0.0.0/0)
      { address: 'aws_security_group.db_sg', type: 'aws_security_group', attributes: { ingress_port: 5432, cidr: '0.0.0.0/0' } },
      { address: 'aws_s3_bucket.telemetry', type: 'aws_s3_bucket', attributes: { versioning: true } },
      // Unmanaged instance created manually in web console
      { address: 'aws_instance.rogue_vm', type: 'aws_instance', attributes: {} }
    ];

    const report = detector.compareState(gitState, liveState);
    assert.equal(report.hasDrift, true);
    assert.equal(report.unmanaged.length, 1);
    assert.equal(report.unmanaged[0], 'aws_instance.rogue_vm');
    assert.equal(report.modified.length, 1);
    assert.equal(report.modified[0].attribute, 'cidr');
  });
});
