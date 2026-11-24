import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RaftHeartbeatWatchdogService {
  constructor(nodeId, peerCount = 3, electionTimeoutMs = 1500) {
    this.peerCount = peerCount;
    this.electionTimeoutMs = electionTimeoutMs;
    this.state = { nodeId, currentTerm: 0, role: 'FOLLOWER', votedFor: null, lastHeartbeatTimestamp: Date.now() };
  }
  receiveHeartbeat(leaderId, leaderTerm) {
    if (leaderTerm >= this.state.currentTerm) {
      this.state.currentTerm = leaderTerm;
      this.state.role = 'FOLLOWER';
      this.state.lastHeartbeatTimestamp = Date.now();
      return true;
    }
    return false;
  }
  checkElectionTimeout(currentTime) {
    if (this.state.role === 'LEADER') return false;
    if (currentTime - this.state.lastHeartbeatTimestamp > this.electionTimeoutMs) {
      this.state.role = 'CANDIDATE';
      this.state.currentTerm++;
      this.state.votedFor = this.state.nodeId;
      return true;
    }
    return false;
  }
  evaluateVotes(votes) {
    if (this.state.role !== 'CANDIDATE') return false;
    const majority = Math.floor(this.peerCount / 2) + 1;
    if (votes >= majority) {
      this.state.role = 'LEADER';
      return true;
    }
    return false;
  }
  getState() { return { ...this.state }; }
}

describe('RaftHeartbeatWatchdogService (Issue #1803)', () => {
  it('should transition follower to candidate upon heartbeat timeout and assume leadership on quorum', () => {
    const raft = new RaftHeartbeatWatchdogService('node-1', 3, 1000);
    assert.equal(raft.getState().role, 'FOLLOWER');

    // Simulate 2000ms passing without leader heartbeat
    const timedOut = raft.checkElectionTimeout(Date.now() + 2000);
    assert.equal(timedOut, true);
    assert.equal(raft.getState().role, 'CANDIDATE');
    assert.equal(raft.getState().currentTerm, 1);

    // Quorum of 2 votes out of 3
    const won = raft.evaluateVotes(2);
    assert.equal(won, true);
    assert.equal(raft.getState().role, 'LEADER');
  });
});
