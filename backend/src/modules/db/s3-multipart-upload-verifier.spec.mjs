import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class S3MultipartUploadVerifierService {
  constructor() { this.store = new Map(); }
  add(u, p) { let m = this.store.get(u) || new Set(); m.add(p); this.store.set(u, m); }
  verify(u, total) {
    const m = this.store.get(u) || new Set();
    const missing = [];
    for (let i = 1; i <= total; i++) if (!m.has(i)) missing.push(i);
    return { ok: missing.length === 0, missing };
  }
}

describe('S3MultipartUploadVerifierService (#2143)', () => {
  test('tracks multipart chunk arrivals and identifies incomplete parts before S3 finalization', () => {
    const verifier = new S3MultipartUploadVerifierService();
    verifier.add('up-1', 1);
    verifier.add('up-1', 3);

    const check = verifier.verify('up-1', 3);
    assert.strictEqual(check.ok, false);
    assert.strictEqual(check.missing[0], 2);
  });
});
