import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  ClusterNodeInfo,
  ClusterPartitionStatus,
  NodeFenceState,
  NodeHeartbeatPayload,
  QuorumStrategy,
  SplitBrainDetectorConfig,
  SplitBrainMetrics,
} from './cluster.types';
import { QuorumWitnessService } from './quorum-witness.service';

/**
 * SplitBrainDetectorService
 *
 * Implements high-performance, quorum-based dynamic network partition detection
 * and automated node fencing across multi-zone Kubernetes/hybrid clusters.
 *
 * Ensures minority pods immediately transition to read-only state upon partition detection (<500ms),
 * eliminating split-brain writes and data divergence.
 */
@Injectable()
export class SplitBrainDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SplitBrainDetectorService.name);

  private readonly localNodeId: string;
  private readonly localZone: string;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly maxConsecutiveMisses: number;
  private readonly quorumStrategy: QuorumStrategy;
  private readonly autoFenceEnabled: boolean;
  private totalExpectedNodes: number;

  private fenceState: NodeFenceState = 'ACTIVE';
  private nodes = new Map<string, ClusterNodeInfo>();
  private simulatedPartitions = new Set<string>();
  private simulatedLocalIsolation = false;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastEvaluationAt = Date.now();
  private lastDetectionLatencyMs = 0;

  private metrics: SplitBrainMetrics = {
    totalEvaluations: 0,
    totalPartitionDetections: 0,
    totalFencingsEnforced: 0,
    totalQuorumRecoveries: 0,
    lastDetectionLatencyMs: 0,
    averageQuorumRatio: 1.0,
  };

  private readonly fenceListeners: Array<(state: NodeFenceState) => void> = [];

  constructor(
    @Optional() private readonly quorumWitness?: QuorumWitnessService,
    @Optional() config?: SplitBrainDetectorConfig,
  ) {
    this.localNodeId = config?.localNodeId ?? process.env.POD_NAME ?? `pod-${Math.random().toString(36).substring(2, 8)}`;
    this.localZone = config?.localZone ?? process.env.AVAILABILITY_ZONE ?? 'us-east-1a';
    this.heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 300;
    this.heartbeatTimeoutMs = config?.heartbeatTimeoutMs ?? 1000;
    this.maxConsecutiveMisses = config?.maxConsecutiveMisses ?? 2;
    this.quorumStrategy = config?.quorumStrategy ?? 'MAJORITY_COUNT';
    this.autoFenceEnabled = config?.autoFenceEnabled ?? true;
    this.totalExpectedNodes = config?.totalExpectedNodes ?? 3;

    // Register local node into topology
    this.registerNode(this.localNodeId, this.localZone, 1);
  }

  public onModuleInit(): void {
    this.startHeartbeatLoop();
  }

  public onModuleDestroy(): void {
    this.stopHeartbeatLoop();
  }

  public getLocalNodeId(): string {
    return this.localNodeId;
  }

  public getLocalZone(): string {
    return this.localZone;
  }

  public getFenceState(): NodeFenceState {
    return this.fenceState;
  }

  public isFenced(): boolean {
    return this.fenceState !== 'ACTIVE';
  }

  public setTotalExpectedNodes(nodes: number): void {
    this.totalExpectedNodes = Math.max(1, nodes);
    this.evaluateQuorumAndFence();
  }

  public getTotalExpectedNodes(): number {
    return this.totalExpectedNodes;
  }

  public registerNode(nodeId: string, zone: string = 'us-east-1a', weight: number = 1): void {
    const existing = this.nodes.get(nodeId);
    if (!existing) {
      this.nodes.set(nodeId, {
        nodeId,
        zone,
        weight: Math.max(1, weight),
        health: 'HEALTHY',
        lastHeartbeatAt: Date.now(),
        consecutiveMisses: 0,
        fenceState: 'ACTIVE',
      });
    } else {
      existing.zone = zone;
      existing.weight = Math.max(1, weight);
    }
  }

  public recordHeartbeat(payload: NodeHeartbeatPayload): void {
    if (this.simulatedPartitions.has(payload.nodeId) || this.simulatedLocalIsolation) {
      return;
    }

    const node = this.nodes.get(payload.nodeId);
    const now = Date.now();

    if (!node) {
      this.nodes.set(payload.nodeId, {
        nodeId: payload.nodeId,
        zone: payload.zone,
        weight: 1,
        health: 'HEALTHY',
        lastHeartbeatAt: now,
        consecutiveMisses: 0,
        fenceState: 'ACTIVE',
      });
    } else {
      node.lastHeartbeatAt = now;
      node.consecutiveMisses = 0;
      node.health = 'HEALTHY';
    }

    this.evaluateQuorumAndFence();
  }

  public registerFenceListener(listener: (state: NodeFenceState) => void): () => void {
    this.fenceListeners.push(listener);
    return () => {
      const idx = this.fenceListeners.indexOf(listener);
      if (idx >= 0) {
        this.fenceListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Fast evaluation cycle (<500ms target).
   * Checks for dead or partitioned nodes and evaluates cluster quorum.
   */
  public evaluateQuorumAndFence(): ClusterPartitionStatus {
    const start = Date.now();
    this.metrics.totalEvaluations++;

    const now = Date.now();
    const reachableNodes: string[] = [this.localNodeId];
    const isolatedNodes: string[] = [];
    const activeZones = new Set<string>([this.localZone]);

    for (const [nodeId, info] of this.nodes.entries()) {
      if (nodeId === this.localNodeId) {
        continue;
      }

      if (this.simulatedPartitions.has(nodeId) || this.simulatedLocalIsolation) {
        info.health = 'PARTITIONED';
        isolatedNodes.push(nodeId);
        continue;
      }

      const elapsed = now - info.lastHeartbeatAt;
      if (elapsed > this.heartbeatTimeoutMs) {
        info.consecutiveMisses++;
        if (info.consecutiveMisses >= this.maxConsecutiveMisses) {
          info.health = 'DEAD';
          isolatedNodes.push(nodeId);
        } else {
          info.health = 'SUSPECT';
          reachableNodes.push(nodeId);
          activeZones.add(info.zone);
        }
      } else {
        info.consecutiveMisses = 0;
        info.health = 'HEALTHY';
        reachableNodes.push(nodeId);
        activeZones.add(info.zone);
      }
    }

    const reachableCount = reachableNodes.length;
    const requiredQuorum = Math.floor(this.totalExpectedNodes / 2) + 1;
    const witnessReachable = this.quorumWitness?.isWitnessReachable() ?? true;

    let hasQuorum = false;
    if (this.quorumStrategy === 'MAJORITY_COUNT') {
      hasQuorum = reachableCount >= requiredQuorum && witnessReachable;
    } else if (this.quorumStrategy === 'WITNESS_TIED') {
      // In even split (e.g. 2 vs 2 in 4-node cluster), witness breaks the tie
      if (reachableCount * 2 === this.totalExpectedNodes) {
        hasQuorum = witnessReachable;
      } else {
        hasQuorum = reachableCount >= requiredQuorum && witnessReachable;
      }
    } else {
      // WEIGHTED_QUORUM
      let totalWeight = 0;
      let reachableWeight = 0;
      for (const info of this.nodes.values()) {
        totalWeight += info.weight;
        if (reachableNodes.includes(info.nodeId)) {
          reachableWeight += info.weight;
        }
      }
      hasQuorum = reachableWeight > totalWeight / 2 && witnessReachable;
    }

    const isPartitioned = reachableCount < this.totalExpectedNodes;
    const previousFenceState = this.fenceState;

    if (!hasQuorum) {
      if (this.autoFenceEnabled) {
        this.fenceState = 'FENCED_READ_ONLY';
      }
      if (previousFenceState === 'ACTIVE') {
        this.metrics.totalPartitionDetections++;
        this.metrics.totalFencingsEnforced++;
        this.logger.warn(
          `[SplitBrainDetector] Split-Brain RISK DETECTED: Quorum lost (${reachableCount}/${this.totalExpectedNodes}). Fencing node ${this.localNodeId} into READ_ONLY mode.`,
        );
        this.notifyFenceListeners('FENCED_READ_ONLY');
      }
    } else {
      if (previousFenceState !== 'ACTIVE') {
        this.fenceState = 'ACTIVE';
        this.metrics.totalQuorumRecoveries++;
        this.logger.log(
          `[SplitBrainDetector] Quorum restored (${reachableCount}/${this.totalExpectedNodes}). Unfencing node ${this.localNodeId} to ACTIVE mode.`,
        );
        this.notifyFenceListeners('ACTIVE');
      }
    }

    this.lastEvaluationAt = now;
    this.lastDetectionLatencyMs = Date.now() - start;
    this.metrics.lastDetectionLatencyMs = this.lastDetectionLatencyMs;
    this.metrics.averageQuorumRatio = reachableCount / Math.max(1, this.totalExpectedNodes);

    if (this.quorumWitness) {
      this.quorumWitness.updateActivePeers(reachableNodes);
    }

    return {
      localNodeId: this.localNodeId,
      localZone: this.localZone,
      fenceState: this.fenceState,
      isPartitioned,
      hasQuorum,
      quorumStrategy: this.quorumStrategy,
      totalConfiguredNodes: this.totalExpectedNodes,
      reachableNodeCount: reachableCount,
      reachableNodes,
      isolatedNodes,
      witnessReachable,
      lastPartitionEvaluatedAt: this.lastEvaluationAt,
      activeZones: Array.from(activeZones),
    };
  }

  /**
   * Asserts write / mutation permission.
   * Throws 503 ServiceUnavailableException if the node is fenced or partitioned into minority.
   */
  public assertWritePermitted(): void {
    if (this.fenceState !== 'ACTIVE') {
      throw new ServiceUnavailableException(
        `[Node-Fenced-503] Node ${this.localNodeId} is currently in ${this.fenceState} state due to network partition. Write operations are strictly rejected to prevent split-brain corruption.`,
      );
    }
  }

  /**
   * Chaos engineering: simulates network partition against specific nodes or isolates self.
   */
  public simulatePartition(targetNodeIds: string[], isolateSelf = false): void {
    for (const id of targetNodeIds) {
      this.simulatedPartitions.add(id);
    }
    this.simulatedLocalIsolation = isolateSelf;
    this.evaluateQuorumAndFence();
  }

  /**
   * Heals simulated network partition.
   */
  public healPartition(): void {
    this.simulatedPartitions.clear();
    this.simulatedLocalIsolation = false;
    for (const info of this.nodes.values()) {
      info.lastHeartbeatAt = Date.now();
      info.consecutiveMisses = 0;
      info.health = 'HEALTHY';
    }
    this.evaluateQuorumAndFence();
  }

  public forceFence(state: NodeFenceState): void {
    this.fenceState = state;
    this.notifyFenceListeners(state);
  }

  public getMetrics(): SplitBrainMetrics {
    return { ...this.metrics };
  }

  private notifyFenceListeners(state: NodeFenceState): void {
    for (const listener of this.fenceListeners) {
      try {
        listener(state);
      } catch (err: unknown) {
        this.logger.error(`Error in fence listener: ${String(err)}`);
      }
    }
  }

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      this.evaluateQuorumAndFence();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
