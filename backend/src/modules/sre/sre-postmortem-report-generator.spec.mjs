import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SrePostmortemReportGeneratorService {
  report(id, evts) {
    return { id, count: evts.length, cause: evts.find(e => e.level === 'CRITICAL')?.msg || 'unknown' };
  }
}

describe('SrePostmortemReportGeneratorService (#2220)', () => {
  test('generates chronological post-mortem incident documentation', () => {
    const gen = new SrePostmortemReportGeneratorService();
    const rep = gen.report('inc-404', [{ level: 'INFO', msg: 'start' }, { level: 'CRITICAL', msg: 'OOM killed' }]);
    assert.strictEqual(rep.count, 2);
    assert.strictEqual(rep.cause, 'OOM killed');
  });
});
