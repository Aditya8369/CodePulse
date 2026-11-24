import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DependencyTyposquatScannerService {
  constructor() { this.popular = ['express', 'lodash', 'prisma']; }
  levenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        m[i][j] = b.charAt(i-1) === a.charAt(j-1) ? m[i-1][j-1] : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
      }
    }
    return m[b.length][a.length];
  }
  scanPackage(name) {
    for (const p of this.popular) {
      if (name !== p && this.levenshtein(name, p) <= 2 && Math.abs(name.length - p.length) <= 1) return { isTyposquat: true, targetPackage: p };
    }
    return { isTyposquat: false };
  }
}

describe('DependencyTyposquatScannerService (Issue #1853)', () => {
  it('should detect typosquatted package names mimicking popular dependencies', () => {
    const scanner = new DependencyTyposquatScannerService();
    assert.equal(scanner.scanPackage('express').isTyposquat, false);
    assert.deepEqual(scanner.scanPackage('expres'), { isTyposquat: true, targetPackage: 'express' });
    assert.deepEqual(scanner.scanPackage('loadsh'), { isTyposquat: true, targetPackage: 'lodash' });
  });
});
