export type RaftRole = 'FOLLOWER' | 'CANDIDATE' | 'LEADER';

export interface RaftState {
  nodeId: string;
  currentTerm: number;
  role: RaftRole;
  votedFor: string | null;
  lastHeartbeatTimestamp: number;
}

export class RaftHeartbeatWatchdogService {
  private state: RaftState;
  private electionTimeoutMs: number;
  private peerCount: number;

  constructor(nodeId: string, peerCount: number = 3, electionTimeoutMs: number = 1500) {
    this.peerCount = peerCount;
    this.electionTimeoutMs = electionTimeoutMs;
    this.state = {
      nodeId,
      currentTerm: 0,
      role: 'FOLLOWER',
      votedFor: null,
      lastHeartbeatTimestamp: Date.now()
    };
  }

  public receiveHeartbeat(leaderId: string, leaderTerm: number): boolean {
    if (leaderTerm >= this.state.currentTerm) {
      this.state.currentTerm = leaderTerm;
      this.state.role = 'FOLLOWER';
      this.state.lastHeartbeatTimestamp = Date.now();
      this.state.votedFor = null;
      return true;
    }
    return false;
  }

  public checkElectionTimeout(currentTime: number): boolean {
    if (this.state.role === 'LEADER') return false;

    if (currentTime - this.state.lastHeartbeatTimestamp > this.electionTimeoutMs) {
      // Transition to Candidate and increment term
      this.state.role = 'CANDIDATE';
      this.state.currentTerm++;
      this.state.votedFor = this.state.nodeId;
      return true;
    }
    return false;
  }

  public evaluateVotes(grantedVotes: number): boolean {
    if (this.state.role !== 'CANDIDATE') return false;
    const majority = Math.floor(this.peerCount / 2) + 1;
    if (grantedVotes >= majority) {
      this.state.role = 'LEADER';
      return true;
    }
    return false;
  }

  public getState(): RaftState {
    return { ...this.state };
  }
}
