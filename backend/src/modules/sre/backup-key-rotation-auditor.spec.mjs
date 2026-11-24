import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BackupKeyRotationAuditorService {
  audit(id, age, chk) {
    const rot = age > 90;
    return { needsRotation: rot, compliant: !rot && chk };
  }
}

describe('BackupKeyRotationAuditorService (#2225)', () => {
  test('audits backup cryptographic envelope age and snapshot checksum integrity', () => {
    const auditor = new BackupKeyRotationAuditorService();
    assert.strictEqual(auditor.audit('snap-1', 45, true).compliant, true);
    assert.strictEqual(auditor.audit('snap-2', 120, true).needsRotation, true);
    assert.strictEqual(auditor.audit('snap-3', 45, false).compliant, false);
  });
});
