import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GitSecretScannerService {
  constructor() {
    this.patterns = [/-----BEGIN PRIVATE KEY-----/, /ghp_[a-zA-Z0-9]{36}/, /AKIA[0-9A-Z]{16}/];
  }
  scanContent(diff) {
    for (const p of this.patterns) {
      if (p.test(diff)) return { hasSecret: true };
    }
    return { hasSecret: false };
  }
}

describe('GitSecretScannerService (Issue #1854)', () => {
  it('should detect private keys and GitHub personal access tokens in commit diffs', () => {
    const scanner = new GitSecretScannerService();
    assert.equal(scanner.scanContent('const x = 42;').hasSecret, false);
    assert.equal(scanner.scanContent('const token = "ghp_123456789012345678901234567890123456";').hasSecret, true);
    assert.equal(scanner.scanContent('-----BEGIN PRIVATE KEY-----\nMIIE...').hasSecret, true);
  });
});
