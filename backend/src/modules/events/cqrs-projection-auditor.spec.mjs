import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CQRSProjectionAuditorService {
  auditAndRepair(eventLog, currentView, reducer) {
    const latest = eventLog[eventLog.length - 1];
    const currentVersion = currentView?.version || 0;
    if (currentView && currentView.version === latest.version) {
      return { updatedView: currentView, report: { inSync: true, replayedEventsCount: 0 } };
    }
    const missing = eventLog.filter(e => e.version > currentVersion);
    let data = currentView ? { ...currentView.data } : {};
    for (const evt of missing) data = reducer(data, evt);
    return {
      updatedView: { aggregateId: latest.aggregateId, version: latest.version, data },
      report: { inSync: false, diverged: true, replayedEventsCount: missing.length }
    };
  }
}

describe('CQRSProjectionAuditorService (Issue #1794)', () => {
  it('should detect stale projection version and self-heal by replaying missed event mutations', () => {
    const auditor = new CQRSProjectionAuditorService();
    const eventLog = [
      { aggregateId: 'user-777', version: 1, eventType: 'CREATED', payload: { points: 10 } },
      { aggregateId: 'user-777', version: 2, eventType: 'AWARDED', payload: { points: 15 } },
      { aggregateId: 'user-777', version: 3, eventType: 'AWARDED', payload: { points: 25 } }
    ];

    // Current projection only at version 1
    const staleView = { aggregateId: 'user-777', version: 1, data: { totalPoints: 10 } };
    const reducer = (state, evt) => ({ totalPoints: (state.totalPoints || 0) + evt.payload.points });

    const result = auditor.auditAndRepair(eventLog, staleView, reducer);
    assert.equal(result.report.diverged, true);
    assert.equal(result.report.replayedEventsCount, 2);
    assert.equal(result.updatedView.version, 3);
    assert.equal(result.updatedView.data.totalPoints, 50); // 10 + 15 + 25
  });
});
