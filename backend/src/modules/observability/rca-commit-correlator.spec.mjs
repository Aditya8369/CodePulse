import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RCACommitCorrelatorService {
  findSuspectDeployments(deps, spikeTs, window = 1000) {
    return deps.filter(d => d.deployedAt <= spikeTs && spikeTs - d.deployedAt <= window);
  }
}

describe('RCACommitCorrelatorService (Issue #1899)', () => {
  it('should correlate error spikes with recently deployed git commits', () => {
    const rca = new RCACommitCorrelatorService();
    const deps = [
      { commitSha: 'c1', deployedAt: 500, author: 'alice' },
      { commitSha: 'c2', deployedAt: 1900, author: 'bob' },
      { commitSha: 'c3', deployedAt: 3000, author: 'carol' }
    ];

    const suspect = rca.findSuspectDeployments(deps, 2000, 500);
    assert.deepEqual(suspect.map(s => s.commitSha), ['c2']);
  });
});
