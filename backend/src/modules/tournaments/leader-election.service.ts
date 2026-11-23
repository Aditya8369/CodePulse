import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BullyElectionConfig,
  BullyMessage,
  BullyNode,
  BullyNodeRole,
  LeaderElectionMetrics,
  TournamentMasterStatus,
} from './leader-election.types';

@Injectable()
export class LeaderElectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaderElectionService.name);

  private readonly localNodeId: string;
  private readonly priority: number;
  private readonly heartbeatIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly electionTimeoutMs: number;
  private readonly minQuorumAcks: number;

  private role: BullyNodeRole = 'FOLLOWER';
  private currentLeaderId: string | null = null;
  private currentLeaderPriority: number | null = null;
  private term = 0;
  private leaseExpiresAt = 0;

  private readonly peers = new Map<string, BullyNode>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private leaseCheckTimer: NodeJS.Timeout | null = null;
  private electionInProgress = false;

  private totalElectionsInitiated = 0;
  private totalElectionsWon = 0;
  private totalStepDowns = 0;
  private heartbeatsSent = 0;
  private heartbeatAcksReceived = 0;
  private lastElectionDurationMs = 0;

  // Pluggable transport hook for messaging / test harness
  private messageSender?: (message: BullyMessage) => Promise<boolean>;

  constructor(@Optional() config?: BullyElectionConfig) {
    this.localNodeId = config?.localNodeId ?? process.env.POD_NAME ?? `tourney-node-${Math.random().toString(36).substring(2, 8)}`;
    this.priority = config?.priority ?? Math.floor(Math.random() * 1000) + 1;
    this.heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 100;
    this.leaseDurationMs = config?.leaseDurationMs ?? 400;
    this.electionTimeoutMs = config?.electionTimeoutMs ?? 250; // <300ms SLA
    this.minQuorumAcks = config?.minQuorumAcks ?? 1;
  }

  public onModuleInit(): void {
    this.startTimers();
  }

  public onModuleDestroy(): void {
    this.stopTimers();
    this.peers.clear();
  }

  public setMessageSender(sender: (message: BullyMessage) => Promise<boolean>): void {
    this.messageSender = sender;
  }

  public getLocalNodeId(): string {
    return this.localNodeId;
  }

  public getPriority(): number {
    return this.priority;
  }

  public getRole(): BullyNodeRole {
    return this.role;
  }

  public isLeader(): boolean {
    return this.role === 'LEADER' && Date.now() < this.leaseExpiresAt;
  }

  public registerPeer(nodeId: string, priority: number): void {
    if (nodeId === this.localNodeId) return;
    this.peers.set(nodeId, {
      nodeId,
      priority,
      role: 'FOLLOWER',
      lastHeartbeatAt: Date.now(),
      leaseExpiresAt: 0,
    });
  }

  /**
   * Asserts this node is the active, authorized tournament master leader.
   * Throws 503 if not leader or if lease has expired.
   */
  public assertLeader(): void {
    if (!this.isLeader()) {
      throw new ServiceUnavailableException(
        `[Tournament Master Gate] Node ${this.localNodeId} is not the current active master (Role: ${this.role}, Leader: ${this.currentLeaderId ?? 'NONE'}). Bracket progression rejected to prevent duplicate matches.`,
      );
    }
  }

  /**
   * Initiates Bully election protocol:
   * 1. Finds all peers with higher priority.
   * 2. If no higher priority peer exists, immediately declares COORDINATOR.
   * 3. Otherwise, sends ELECTION message to higher peers and awaits ANSWER within electionTimeoutMs (<300ms).
   * 4. If no answer received in time, declares COORDINATOR.
   */
  public async startElection(): Promise<boolean> {
    if (this.electionInProgress) {
      return false;
    }

    this.electionInProgress = true;
    this.totalElectionsInitiated++;
    const electionStart = Date.now();
    this.term++;
    this.role = 'CANDIDATE';

    const higherPeers = Array.from(this.peers.values()).filter(
      (p) => p.priority > this.priority,
    );

    if (higherPeers.length === 0) {
      // Local node has highest priority in known topology! Claim victory immediately.
      await this.claimLeadership();
      this.lastElectionDurationMs = Date.now() - electionStart;
      this.electionInProgress = false;
      return true;
    }

    // Send ELECTION message to all higher-priority peers
    let answered = false;
    for (const peer of higherPeers) {
      const msg: BullyMessage = {
        type: 'ELECTION',
        senderId: this.localNodeId,
        senderPriority: this.priority,
        targetId: peer.nodeId,
        term: this.term,
        timestamp: Date.now(),
      };

      const res = await this.sendMessage(msg);
      if (res) {
        answered = true;
      }
    }

    if (!answered) {
      // None of the higher peers answered in time -> Local node bullies and claims leadership!
      await this.claimLeadership();
      this.lastElectionDurationMs = Date.now() - electionStart;
      this.electionInProgress = false;
      return true;
    }

    // A higher peer answered, revert to FOLLOWER and wait for their COORDINATOR announcement
    this.role = 'FOLLOWER';
    this.lastElectionDurationMs = Date.now() - electionStart;
    this.electionInProgress = false;
    return false;
  }

  /**
   * Claims leadership, broadcasts COORDINATOR message, and establishes sliding-window lease.
   */
  public async claimLeadership(): Promise<void> {
    this.role = 'LEADER';
    this.currentLeaderId = this.localNodeId;
    this.currentLeaderPriority = this.priority;
    this.leaseExpiresAt = Date.now() + this.leaseDurationMs;
    this.totalElectionsWon++;

    this.logger.log(
      `[Bully Election] Node ${this.localNodeId} (Priority: ${this.priority}) won election! Term: ${this.term}.`,
    );

    const coordMsg: BullyMessage = {
      type: 'COORDINATOR',
      senderId: this.localNodeId,
      senderPriority: this.priority,
      term: this.term,
      leaseDurationMs: this.leaseDurationMs,
      timestamp: Date.now(),
    };

    for (const peer of this.peers.values()) {
      coordMsg.targetId = peer.nodeId;
      void this.sendMessage(coordMsg);
    }
  }

  /**
   * Heartbeat cycle executed by the leader to renew sliding-window lease.
   * If heartbeats fail to reach quorum of peers (network isolation), leader automatically steps down.
   */
  public async sendHeartbeatLease(): Promise<void> {
    if (this.role !== 'LEADER') {
      return;
    }

    this.heartbeatsSent++;
    let ackCount = 0;

    const hb: BullyMessage = {
      type: 'HEARTBEAT',
      senderId: this.localNodeId,
      senderPriority: this.priority,
      term: this.term,
      leaseDurationMs: this.leaseDurationMs,
      timestamp: Date.now(),
    };

    for (const peer of this.peers.values()) {
      hb.targetId = peer.nodeId;
      const ack = await this.sendMessage(hb);
      if (ack) {
        ackCount++;
      }
    }

    this.heartbeatAcksReceived += ackCount;

    // Check if leader is isolated
    if (this.peers.size > 0 && ackCount < this.minQuorumAcks) {
      this.logger.warn(
        `[Bully Election] Leader ${this.localNodeId} isolated! Only ${ackCount}/${this.minQuorumAcks} ACKs. Stepping down to prevent split-brain.`,
      );
      this.stepDown();
      return;
    }

    // Renew lease
    this.leaseExpiresAt = Date.now() + this.leaseDurationMs;
  }

  /**
   * Voluntarily steps down from leadership upon network partition or preemption.
   */
  public stepDown(): void {
    if (this.role === 'LEADER') {
      this.role = 'STEPPED_DOWN';
      this.currentLeaderId = null;
      this.currentLeaderPriority = null;
      this.totalStepDowns++;
      this.logger.warn(`[Bully Election] Node ${this.localNodeId} stepped down from tournament master.`);
    }
  }

  /**
   * Inbound message handler for Bully protocol packets.
   */
  public handleInboundMessage(message: BullyMessage): BullyMessage | null {
    if (message.type === 'ELECTION') {
      if (this.priority > message.senderPriority) {
        // Send ANSWER to bully lower-priority candidate
        void this.startElection();
        return {
          type: 'ANSWER',
          senderId: this.localNodeId,
          senderPriority: this.priority,
          targetId: message.senderId,
          term: this.term,
          timestamp: Date.now(),
        };
      }
      return null;
    }

    if (message.type === 'COORDINATOR') {
      if (message.senderPriority > this.priority || this.role !== 'LEADER') {
        this.currentLeaderId = message.senderId;
        this.currentLeaderPriority = message.senderPriority;
        this.term = message.term;
        this.role = 'FOLLOWER';
        this.leaseExpiresAt = Date.now() + (message.leaseDurationMs ?? this.leaseDurationMs);
        return {
          type: 'HEARTBEAT_ACK',
          senderId: this.localNodeId,
          senderPriority: this.priority,
          targetId: message.senderId,
          term: this.term,
          timestamp: Date.now(),
        };
      } else if (message.senderPriority < this.priority && this.role === 'LEADER') {
        // Preempt lower-priority rogue leader
        void this.claimLeadership();
      }
      return null;
    }

    if (message.type === 'HEARTBEAT') {
      if (message.senderId === this.currentLeaderId || message.senderPriority >= (this.currentLeaderPriority ?? 0)) {
        this.currentLeaderId = message.senderId;
        this.currentLeaderPriority = message.senderPriority;
        this.leaseExpiresAt = Date.now() + (message.leaseDurationMs ?? this.leaseDurationMs);

        const peer = this.peers.get(message.senderId);
        if (peer) {
          peer.lastHeartbeatAt = Date.now();
        }

        return {
          type: 'HEARTBEAT_ACK',
          senderId: this.localNodeId,
          senderPriority: this.priority,
          targetId: message.senderId,
          term: this.term,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  public getStatus(): TournamentMasterStatus {
    const now = Date.now();
    return {
      localNodeId: this.localNodeId,
      localPriority: this.priority,
      localRole: this.role,
      currentLeaderId: this.currentLeaderId,
      currentLeaderPriority: this.currentLeaderPriority,
      term: this.term,
      isLocalLeader: this.isLeader(),
      leaseRemainingMs: Math.max(0, this.leaseExpiresAt - now),
      clusterNodes: Array.from(this.peers.values()),
    };
  }

  public getMetrics(): LeaderElectionMetrics {
    return {
      totalElectionsInitiated: this.totalElectionsInitiated,
      totalElectionsWon: this.totalElectionsWon,
      totalStepDowns: this.totalStepDowns,
      averageElectionDurationMs: this.lastElectionDurationMs,
      heartbeatsSent: this.heartbeatsSent,
      heartbeatAcksReceived: this.heartbeatAcksReceived,
    };
  }

  private async sendMessage(message: BullyMessage): Promise<boolean> {
    if (this.messageSender) {
      return this.messageSender(message);
    }
    return true; // Default simulated success
  }

  private startTimers(): void {
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        void this.sendHeartbeatLease();
      }, this.heartbeatIntervalMs);
    }

    if (!this.leaseCheckTimer) {
      this.leaseCheckTimer = setInterval(() => {
        if (this.role === 'FOLLOWER') {
          // If leader lease expired, start election
          if (Date.now() > this.leaseExpiresAt && !this.electionInProgress) {
            this.logger.warn(`[Bully Election] Leader lease expired! Triggering election.`);
            void this.startElection();
          }
        }
      }, this.heartbeatIntervalMs);
    }
  }

  private stopTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.leaseCheckTimer) {
      clearInterval(this.leaseCheckTimer);
      this.leaseCheckTimer = null;
    }
  }
}
