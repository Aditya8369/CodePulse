import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CSPViolationCollectorService {
  constructor() { this.reports = []; }
  collect(r) { this.reports.push(r); }
  getViolationsCount() { return this.reports.length; }
}

describe('CSPViolationCollectorService (Issue #1849)', () => {
  it('should collect and track browser Content Security Policy violation reports', () => {
    const collector = new CSPViolationCollectorService();
    collector.collect({ documentUri: 'https://codepulse.io/battle', blockedUri: 'http://malicious.cdn.com/evil.js', violatedDirective: 'script-src' });
    assert.equal(collector.getViolationsCount(), 1);
  });
});
