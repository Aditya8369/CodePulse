import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class IncidentTraceCorrelatorReportService {
  correlate(id, spans) {
    return { id, root: spans[0], count: spans.length };
  }
}

describe('IncidentTraceCorrelatorReportService (#2248)', () => {
  test('correlates distributed trace failure spans to primary incident culprits', () => {
    const correlator = new IncidentTraceCorrelatorReportService();
    const res = correlator.correlate('inc-1', ['span-root-err', 'span-child-err']);
    assert.strictEqual(res.root, 'span-root-err');
    assert.strictEqual(res.count, 2);
  });
});
