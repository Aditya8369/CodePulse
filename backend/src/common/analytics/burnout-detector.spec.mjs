import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BurnoutDetectorService {
  constructor(highRiskThreshold = 65) {
    this.highRiskThreshold = highRiskThreshold;
  }
  evaluateTeamActivity(teamName, commits) {
    if (commits.length === 0) return { teamName, burnoutRiskScore: 0, alertTriggered: false };
    let late = 0, weekend = 0;
    for (const c of commits) {
      const d = new Date(c.timestamp);
      const h = d.getUTCHours();
      const day = d.getUTCDay();
      if (h >= 23 || h < 5) late++;
      if (day === 0 || day === 6) weekend++;
    }
    const lateRatio = late / commits.length;
    const weekendRatio = weekend / commits.length;
    const score = Math.min(100, Math.round(lateRatio * 150) + Math.round(weekendRatio * 100));
    return {
      teamName,
      totalCommits: commits.length,
      burnoutRiskScore: score,
      alertTriggered: score >= this.highRiskThreshold
    };
  }
}

describe('BurnoutDetectorService (Issue #1451)', () => {
  it('should flag HIGH burnout risk when late night and weekend commits spike', () => {
    const detector = new BurnoutDetectorService();
    const commits = [
      { commitId: 'c1', timestamp: '2026-11-21T01:30:00Z', linesChanged: 50 }, // Saturday 01:30
      { commitId: 'c2', timestamp: '2026-11-21T03:00:00Z', linesChanged: 30 }, // Saturday 03:00
      { commitId: 'c3', timestamp: '2026-11-22T02:00:00Z', linesChanged: 40 }, // Sunday 02:00
      { commitId: 'c4', timestamp: '2026-11-23T14:00:00Z', linesChanged: 20 }  // Monday 14:00
    ];
    const report = detector.evaluateTeamActivity('Team Alpha', commits);
    assert.equal(report.alertTriggered, true);
    assert.ok(report.burnoutRiskScore >= 65);
  });

  it('should report HEALTHY for regular business hour commits', () => {
    const detector = new BurnoutDetectorService();
    const commits = [
      { commitId: 'c1', timestamp: '2026-11-23T10:00:00Z', linesChanged: 50 },
      { commitId: 'c2', timestamp: '2026-11-24T14:00:00Z', linesChanged: 30 }
    ];
    const report = detector.evaluateTeamActivity('Team Beta', commits);
    assert.equal(report.alertTriggered, false);
    assert.equal(report.burnoutRiskScore, 0);
  });
});
