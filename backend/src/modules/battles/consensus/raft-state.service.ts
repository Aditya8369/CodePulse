import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { WalLogService, WalCommand, WalEntry } from './wal-log.service';

export type RaftRole = 'LEADER' | 'FOLLOWER' | 'CANDIDATE';

export interface RaftNodeState {
  nodeId: string;
  battleId: string;
  role: RaftRole;
  currentTerm: number;
  votedFor: string | null;
  commitIndex: number;
  lastApplied: number;
  peers: string[];
  leaderId: string | null;
  lastHeartbeatTime: number;
}

export interface RequestVoteArgs {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteReply {
  term: number;
  voteGranted: boolean;
}

export interface AppendEntriesArgs {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: WalEntry[];
  leaderCommit: number;
}

export interface AppendEntriesReply {
  term: number;
  success: boolean;
  matchIndex: number;
}

@Injectable()
export class RaftStateService implements OnModuleDestroy {
  private readonly logger = new Logger(RaftStateService.name);
  private readonly nodes = new Map<string, RaftNodeState>();
  private readonly heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private readonly electionTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly partitionedNodes = new Set<string>();

  // Heartbeat interval 150ms as per requirements
  public static readonly HEARTBEAT_INTERVAL_MS = 150;
  // Election timeout 250 - 300ms (triggers follower election in under 300ms)
  public static readonly ELECTION_TIMEOUT_MIN_MS = 250;
  public static readonly ELECTION_TIMEOUT_MAX_MS = 300;

  constructor(private readonly walLogService: WalLogService) {}

  public onModuleDestroy(): void {
    this.clearAllTimers();
  }

  public clearAllTimers(): void {
    this.heartbeatIntervals.forEach((timer) => clearInterval(timer));
    this.heartbeatIntervals.clear();
    this.electionTimeouts.forEach((timer) => clearTimeout(timer));
    this.electionTimeouts.clear();
  }

  /**
   * Initializes a Raft node for a given battle room with a list of peer pod IDs.
   */
  public initializeNode(
    battleId: string,
    nodeId: string,
    peers: string[] = [],
  ): RaftNodeState {
    const key = `${battleId}:${nodeId}`;
    const state: RaftNodeState = {
      nodeId,
      battleId,
      role: 'FOLLOWER',
      currentTerm: 1,
      votedFor: null,
      commitIndex: 0,
      lastApplied: 0,
      peers,
      leaderId: null,
      lastHeartbeatTime: Date.now(),
    };

    this.nodes.set(key, state);
    this.resetElectionTimeout(battleId, nodeId);
    return state;
  }

  public getNode(battleId: string, nodeId: string): RaftNodeState | undefined {
    return this.nodes.get(`${battleId}:${nodeId}`);
  }

  public isLeader(battleId: string, nodeId: string): boolean {
    const state = this.getNode(battleId, nodeId);
    return state?.role === 'LEADER';
  }

  public getLeader(battleId: string, nodeId: string): string | null {
    const state = this.getNode(battleId, nodeId);
    return state?.leaderId ?? null;
  }

  /**
   * Starts a Raft leader election when heartbeat timeout expires.
   */
  public async startElection(battleId: string, nodeId: string): Promise<boolean> {
    const state = this.getNode(battleId, nodeId);
    if (!state || this.partitionedNodes.has(nodeId)) return false;

    // Transition to Candidate
    state.role = 'CANDIDATE';
    state.currentTerm += 1;
    state.votedFor = nodeId;
    state.leaderId = null;
    this.logger.log(`[RAFT] Node ${nodeId} became CANDIDATE for term ${state.currentTerm}`);

    let votesReceived = 1; // Self-vote
    const clusterSize = state.peers.length + 1;
    const quorumNeeded = Math.floor(clusterSize / 2) + 1;

    const lastEntry = this.walLogService.getLastEntry(battleId);
    const voteArgs: RequestVoteArgs = {
      term: state.currentTerm,
      candidateId: nodeId,
      lastLogIndex: lastEntry?.index || 0,
      lastLogTerm: lastEntry?.term || 0,
    };

    // Request votes from peers
    for (const peerId of state.peers) {
      if (this.partitionedNodes.has(peerId)) continue;

      const peerState = this.getNode(battleId, peerId);
      if (peerState) {
        const reply = this.handleRequestVote(battleId, peerId, voteArgs);
        if (reply.voteGranted) {
          votesReceived += 1;
        } else if (reply.term > state.currentTerm) {
          this.stepDown(battleId, nodeId, reply.term);
          return false;
        }
      }
    }

    if (votesReceived >= quorumNeeded) {
      state.role = 'LEADER';
      state.leaderId = nodeId;
      this.logger.log(
        `[RAFT] Node ${nodeId} elected LEADER for Battle ${battleId} in term ${state.currentTerm} (votes: ${votesReceived}/${clusterSize})`,
      );
      this.startHeartbeatBroadcast(battleId, nodeId);
      return true;
    }

    // Failed to secure quorum, remain follower or candidate
    this.resetElectionTimeout(battleId, nodeId);
    return false;
  }

  /**
   * Handles incoming RequestVote RPC on a follower/candidate node.
   */
  public handleRequestVote(
    battleId: string,
    nodeId: string,
    args: RequestVoteArgs,
  ): RequestVoteReply {
    const state = this.getNode(battleId, nodeId);
    if (!state || this.partitionedNodes.has(nodeId)) {
      return { term: 0, voteGranted: false };
    }

    if (args.term > state.currentTerm) {
      this.stepDown(battleId, nodeId, args.term);
    }

    const canVote =
      args.term === state.currentTerm &&
      (state.votedFor === null || state.votedFor === args.candidateId);

    const lastEntry = this.walLogService.getLastEntry(battleId);
    const isLogUpToDate =
      args.lastLogTerm > (lastEntry?.term || 0) ||
      (args.lastLogTerm === (lastEntry?.term || 0) &&
        args.lastLogIndex >= (lastEntry?.index || 0));

    if (canVote && isLogUpToDate) {
      state.votedFor = args.candidateId;
      this.resetElectionTimeout(battleId, nodeId);
      return { term: state.currentTerm, voteGranted: true };
    }

    return { term: state.currentTerm, voteGranted: false };
  }

  /**
   * Proposes a new battle command from the leader, requiring quorum commit.
   */
  public async proposeCommand(
    battleId: string,
    nodeId: string,
    command: WalCommand,
    payload: Record<string, unknown>,
  ): Promise<{ success: boolean; commitIndex: number; quorum: boolean }> {
    const state = this.getNode(battleId, nodeId);
    if (!state || state.role !== 'LEADER' || this.partitionedNodes.has(nodeId)) {
      return { success: false, commitIndex: 0, quorum: false };
    }

    // Append to local WAL
    const entry = await this.walLogService.append(
      battleId,
      state.currentTerm,
      command,
      payload,
    );

    // Replicate across peers and require quorum before commit
    let acks = 1; // Self ack
    const clusterSize = state.peers.length + 1;
    const quorumNeeded = Math.floor(clusterSize / 2) + 1;

    for (const peerId of state.peers) {
      if (this.partitionedNodes.has(peerId)) continue;

      const appendArgs: AppendEntriesArgs = {
        term: state.currentTerm,
        leaderId: nodeId,
        prevLogIndex: entry.index - 1,
        prevLogTerm: entry.term,
        entries: [entry],
        leaderCommit: state.commitIndex,
      };

      const reply = this.handleAppendEntries(battleId, peerId, appendArgs);
      if (reply.success) {
        acks += 1;
      }
    }

    const hasQuorum = acks >= quorumNeeded;
    if (hasQuorum) {
      state.commitIndex = entry.index;
      await this.walLogService.commit(battleId, entry.index);
      return { success: true, commitIndex: entry.index, quorum: true };
    }

    // No quorum: isolate uncommitted entry to preserve state machine safety
    return { success: false, commitIndex: state.commitIndex, quorum: false };
  }

  /**
   * Handles AppendEntries RPC (Heartbeat & Log Replication) on followers.
   */
  public handleAppendEntries(
    battleId: string,
    nodeId: string,
    args: AppendEntriesArgs,
  ): AppendEntriesReply {
    const state = this.getNode(battleId, nodeId);
    if (!state || this.partitionedNodes.has(nodeId)) {
      return { term: 0, success: false, matchIndex: 0 };
    }

    if (args.term < state.currentTerm) {
      return { term: state.currentTerm, success: false, matchIndex: state.commitIndex };
    }

    if (args.term > state.currentTerm || state.role !== 'FOLLOWER') {
      this.stepDown(battleId, nodeId, args.term);
    }

    state.leaderId = args.leaderId;
    state.lastHeartbeatTime = Date.now();
    this.resetElectionTimeout(battleId, nodeId);

    // Append entries if present
    if (args.entries.length > 0) {
      for (const entry of args.entries) {
        // Replicate entry to follower WAL if not existing
        const last = this.walLogService.getLastEntry(battleId);
        if (!last || last.index < entry.index) {
          void this.walLogService.append(battleId, entry.term, entry.command, entry.payload);
        }
      }
    }

    // Update follower commit index
    if (args.leaderCommit > state.commitIndex) {
      state.commitIndex = Math.min(
        args.leaderCommit,
        this.walLogService.getLastEntry(battleId)?.index || 0,
      );
      void this.walLogService.commit(battleId, state.commitIndex);
    }

    return {
      term: state.currentTerm,
      success: true,
      matchIndex: state.commitIndex,
    };
  }

  /**
   * Broadcasts heartbeats (150ms) from Leader to all followers.
   */
  public startHeartbeatBroadcast(battleId: string, leaderId: string): void {
    const key = `${battleId}:${leaderId}`;
    if (this.heartbeatIntervals.has(key)) {
      clearInterval(this.heartbeatIntervals.get(key));
    }

    const interval = setInterval(() => {
      const state = this.getNode(battleId, leaderId);
      if (!state || state.role !== 'LEADER' || this.partitionedNodes.has(leaderId)) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(key);
        return;
      }

      for (const peerId of state.peers) {
        if (this.partitionedNodes.has(peerId)) continue;

        const args: AppendEntriesArgs = {
          term: state.currentTerm,
          leaderId,
          prevLogIndex: state.commitIndex,
          prevLogTerm: state.currentTerm,
          entries: [],
          leaderCommit: state.commitIndex,
        };

        this.handleAppendEntries(battleId, peerId, args);
      }
    }, RaftStateService.HEARTBEAT_INTERVAL_MS);

    this.heartbeatIntervals.set(key, interval);
  }

  /**
   * Transitions node down to Follower.
   */
  public stepDown(battleId: string, nodeId: string, newTerm: number): void {
    const state = this.getNode(battleId, nodeId);
    if (!state) return;

    state.role = 'FOLLOWER';
    state.currentTerm = newTerm;
    state.votedFor = null;
    state.leaderId = null;

    const key = `${battleId}:${nodeId}`;
    if (this.heartbeatIntervals.has(key)) {
      clearInterval(this.heartbeatIntervals.get(key));
      this.heartbeatIntervals.delete(key);
    }

    this.resetElectionTimeout(battleId, nodeId);
  }

  /**
   * Resets the randomized election timeout.
   */
  private resetElectionTimeout(battleId: string, nodeId: string): void {
    const key = `${battleId}:${nodeId}`;
    if (this.electionTimeouts.has(key)) {
      clearTimeout(this.electionTimeouts.get(key));
    }

    const randomTimeout =
      Math.floor(
        Math.random() *
          (RaftStateService.ELECTION_TIMEOUT_MAX_MS -
            RaftStateService.ELECTION_TIMEOUT_MIN_MS +
            1),
      ) + RaftStateService.ELECTION_TIMEOUT_MIN_MS;

    const timeout = setTimeout(() => {
      const state = this.getNode(battleId, nodeId);
      if (state && state.role !== 'LEADER' && !this.partitionedNodes.has(nodeId)) {
        void this.startElection(battleId, nodeId);
      }
    }, randomTimeout);

    this.electionTimeouts.set(key, timeout);
  }

  /**
   * Simulates network partition isolating specific pods.
   */
  public simulatePartition(isolatedNodeIds: string[]): void {
    isolatedNodeIds.forEach((id) => this.partitionedNodes.add(id));
    this.logger.warn(`[RAFT] Network partition isolated nodes: ${isolatedNodeIds.join(', ')}`);
  }

  /**
   * Recovers all network partitions, reconnecting all nodes.
   */
  public recoverPartition(): void {
    this.partitionedNodes.clear();
    this.logger.log(`[RAFT] Network partition recovered. All nodes reconnected.`);
  }
}
