import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { NodeRegistryService } from './node-registry.service';
import type {
  GossipUpdate,
  SwimClusterMetrics,
  SwimConfig,
  SwimMember,
  SwimPacket,
} from './swim-gossip.types';

@Injectable()
export class SwimGossipService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SwimGossipService.name);

  private readonly localNodeId: string;
  private readonly localAddress: string;
  private readonly localPort: number;
  private readonly probeIntervalMs: number;
  private readonly probeTimeoutMs: number;
  private readonly indirectProbeCount: number;
  private readonly suspectTimeoutMs: number;
  private readonly disseminationFactor: number;

  private probeTimer: NodeJS.Timeout | null = null;
  private suspectCheckTimer: NodeJS.Timeout | null = null;
  private sequenceCounter = 0;

  private probesCompleted = 0;
  private indirectProbesTriggered = 0;
  private messagesTransmitted = 0;
  private updatesDisseminated = 0;
  private falsePositiveFailures = 0;

  // In-memory packet delivery simulation / hook for tests and transports
  private packetSender?: (packet: SwimPacket) => Promise<boolean>;

  constructor(
    private readonly registry: NodeRegistryService,
    @Optional() config?: SwimConfig,
  ) {
    this.localNodeId = config?.localNodeId ?? process.env.POD_NAME ?? `swim-node-${Math.random().toString(36).substring(2, 8)}`;
    this.localAddress = config?.localAddress ?? '127.0.0.1';
    this.localPort = config?.localPort ?? 8000;
    this.probeIntervalMs = config?.probeIntervalMs ?? 1000;
    this.probeTimeoutMs = config?.probeTimeoutMs ?? 300;
    this.indirectProbeCount = config?.indirectProbeCount ?? 3;
    this.suspectTimeoutMs = config?.suspectTimeoutMs ?? 3000;
    this.disseminationFactor = config?.disseminationFactor ?? 3;

    // Self-register in registry
    this.registry.registerMember({
      nodeId: this.localNodeId,
      address: this.localAddress,
      port: this.localPort,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });
  }

  public onModuleInit(): void {
    this.startTimers();
  }

  public onModuleDestroy(): void {
    this.stopTimers();
  }

  public setPacketSender(sender: (packet: SwimPacket) => Promise<boolean>): void {
    this.packetSender = sender;
  }

  public getLocalNodeId(): string {
    return this.localNodeId;
  }

  /**
   * Executes a single SWIM probe cycle:
   * 1. Direct Ping
   * 2. Indirect Ping-Req via k peers upon direct failure
   * 3. Transitions to SUSPECT if still unreachable
   */
  public async executeProbeCycle(): Promise<{ targetNodeId?: string; directAck: boolean; indirectAck: boolean }> {
    const alivePeers = this.registry.getAliveMembers(this.localNodeId);
    if (alivePeers.length === 0) {
      return { directAck: false, indirectAck: false };
    }

    // Select random peer
    const targetIndex = Math.floor(Math.random() * alivePeers.length);
    const target = alivePeers[targetIndex];
    this.probesCompleted++;

    const pingPacket = this.createPacket('PING', target.nodeId);
    const directSuccess = await this.sendPacket(pingPacket);

    if (directSuccess) {
      target.lastSeenAt = Date.now();
      return { targetNodeId: target.nodeId, directAck: true, indirectAck: false };
    }

    // Direct ping timed out! Trigger indirect PING_REQ to k peers
    this.indirectProbesTriggered++;
    const otherPeers = alivePeers.filter((p) => p.nodeId !== target.nodeId);
    const k = Math.min(this.indirectProbeCount, otherPeers.length);
    const selectedIndirectPeers = this.shuffleArray(otherPeers).slice(0, k);

    let indirectSuccess = false;
    for (const indirectPeer of selectedIndirectPeers) {
      const pingReqPacket = this.createPacket('PING_REQ', indirectPeer.nodeId, target.nodeId);
      const ack = await this.sendPacket(pingReqPacket);
      if (ack) {
        indirectSuccess = true;
        break;
      }
    }

    if (!indirectSuccess) {
      // Both direct and indirect failed -> Mark member as SUSPECT
      this.registry.updateMemberStatus(target.nodeId, 'SUSPECT', target.incarnation);
      this.logger.warn(`[SWIM Gossip] Member ${target.nodeId} failed direct & indirect probes -> marked SUSPECT.`);
    }

    return {
      targetNodeId: target.nodeId,
      directAck: directSuccess,
      indirectAck: indirectSuccess,
    };
  }

  /**
   * Processes inbound SWIM packets from the network / peer nodes.
   */
  public handleInboundPacket(packet: SwimPacket): SwimPacket | null {
    // Process piggybacked gossip updates first
    const maxDisseminations = Math.ceil(this.disseminationFactor * Math.log2(Math.max(2, this.registry.getAllMembers().length)));
    for (const update of packet.piggybackedUpdates) {
      const res = this.registry.applyGossipUpdate(update, this.localNodeId);
      if (res.refuted) {
        this.falsePositiveFailures++;
      }
      this.updatesDisseminated++;
    }

    if (packet.type === 'PING') {
      return this.createPacket('ACK', packet.sourceNodeId);
    }

    if (packet.type === 'PING_REQ' && packet.indirectTargetNodeId) {
      // Check if target is locally reachable
      const target = this.registry.getMember(packet.indirectTargetNodeId);
      const isAlive = target && target.status === 'ALIVE';
      if (isAlive) {
        return this.createPacket('ACK', packet.sourceNodeId, packet.indirectTargetNodeId);
      }
    }

    if (packet.type === 'JOIN') {
      this.registry.registerMember({
        nodeId: packet.sourceNodeId,
        address: '127.0.0.1',
        port: 8000,
        status: 'ALIVE',
        incarnation: 0,
        lastSeenAt: Date.now(),
      });
      return this.createPacket('ACK', packet.sourceNodeId);
    }

    return null;
  }

  /**
   * Evaluates suspect members and declares them DEAD if suspect timeout has elapsed.
   */
  public evaluateSuspectTimeouts(): number {
    const suspects = this.registry.getSuspectMembers();
    const now = Date.now();
    let deadCount = 0;

    for (const suspect of suspects) {
      if (suspect.suspectSince && now - suspect.suspectSince > this.suspectTimeoutMs) {
        this.registry.updateMemberStatus(suspect.nodeId, 'DEAD', suspect.incarnation);
        this.logger.warn(`[SWIM Gossip] Suspect member ${suspect.nodeId} timed out -> declared DEAD.`);
        deadCount++;
      }
    }

    return deadCount;
  }

  public getMetrics(): SwimClusterMetrics {
    const all = this.registry.getAllMembers();
    return {
      localNodeId: this.localNodeId,
      totalMembers: all.length,
      aliveMembersCount: all.filter((m) => m.status === 'ALIVE').length,
      suspectMembersCount: all.filter((m) => m.status === 'SUSPECT').length,
      deadMembersCount: all.filter((m) => m.status === 'DEAD').length,
      probesCompleted: this.probesCompleted,
      indirectProbesTriggered: this.indirectProbesTriggered,
      messagesTransmitted: this.messagesTransmitted,
      updatesDisseminated: this.updatesDisseminated,
      falsePositiveFailureCount: this.falsePositiveFailures,
    };
  }

  private createPacket(
    type: SwimPacket['type'],
    targetNodeId: string,
    indirectTargetNodeId?: string,
  ): SwimPacket {
    this.sequenceCounter++;
    const piggyback = this.registry.drainPiggybackUpdates(5);

    return {
      type,
      sourceNodeId: this.localNodeId,
      targetNodeId,
      sequenceNumber: this.sequenceCounter,
      indirectTargetNodeId,
      piggybackedUpdates: piggyback,
      timestamp: Date.now(),
    };
  }

  private async sendPacket(packet: SwimPacket): Promise<boolean> {
    this.messagesTransmitted++;
    if (this.packetSender) {
      return this.packetSender(packet);
    }
    return true; // Default simulated success
  }

  private startTimers(): void {
    if (!this.probeTimer) {
      this.probeTimer = setInterval(() => {
        void this.executeProbeCycle();
      }, this.probeIntervalMs);
    }

    if (!this.suspectCheckTimer) {
      this.suspectCheckTimer = setInterval(() => {
        this.evaluateSuspectTimeouts();
      }, Math.floor(this.suspectTimeoutMs / 2));
    }
  }

  private stopTimers(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.suspectCheckTimer) {
      clearInterval(this.suspectCheckTimer);
      this.suspectCheckTimer = null;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
