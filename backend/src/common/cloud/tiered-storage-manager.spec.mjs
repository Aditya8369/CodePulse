import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TieredStorageManagerService {
  constructor() { this.artifacts = new Map(); }
  uploadArtifact(key, size, uploadedAt = Date.now()) {
    const a = { key, size, uploadedAt, currentClass: 'STANDARD', replicatedToGcs: true };
    this.artifacts.set(key, a);
    return a;
  }
  runLifecycleEvaluation(now = Date.now()) {
    let toIa = 0, toCold = 0;
    for (const a of this.artifacts.values()) {
      const age = (now - a.uploadedAt) / (1000 * 60 * 60 * 24);
      if (age >= 180 && a.currentClass !== 'COLDLINE') {
        a.currentClass = 'COLDLINE'; toCold++;
      } else if (age >= 30 && age < 180 && a.currentClass === 'STANDARD') {
        a.currentClass = 'INFREQUENT_ACCESS'; toIa++;
      }
    }
    return { toIa, toCold };
  }
}

describe('TieredStorageManagerService (Issue #1434)', () => {
  it('should transition artifacts across Standard -> Infrequent Access -> Coldline based on age', () => {
    const storage = new TieredStorageManagerService();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const fresh = storage.uploadArtifact('src/fresh.tar.gz', 1024, now - 5 * dayMs);
    const aged35 = storage.uploadArtifact('src/month_old.tar.gz', 2048, now - 35 * dayMs);
    const aged200 = storage.uploadArtifact('src/archive.tar.gz', 5000, now - 200 * dayMs);

    const report = storage.runLifecycleEvaluation(now);
    assert.equal(report.toIa, 1);
    assert.equal(report.toCold, 1);

    assert.equal(fresh.currentClass, 'STANDARD');
    assert.equal(aged35.currentClass, 'INFREQUENT_ACCESS');
    assert.equal(aged200.currentClass, 'COLDLINE');
  });
});
