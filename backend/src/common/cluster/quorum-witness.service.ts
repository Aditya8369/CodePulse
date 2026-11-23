import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type ClusterMode = 'READ_WRITE' | 'READ_ONLY_SAFE_MODE';

export interface QuorumWitnessConfig {
  totalExpectedNodes: number;
  heartbeatIntervalMs?: number;
  nodeTtlSeconds?: number;
  witnessKeyPrefix?: string;
}

export interface ClusterQuorumStatus {
  nodeId: string;
  clusterMode: ClusterMode;
  reachableNodes: number;
  totalConfiguredNodes: number;
  quorumThreshold: number;
  hasQuorum: boolean;
  witnessReachable: boolean;
  lastWitnessCheckAt: number;
}

@Injectable()
export class QuorumWitnessService implements OnModuleDestroy {
  private readonly logger = new Logger(QuorumWitnessService.name);

  private readonly nodeId: string;
  private totalExpectedNodes: number;
  private readonly heartbeatIntervalMs: number;
  private readonly nodeTtlSeconds: number;
  private readonly witnessKeyPrefix: string;

  private clusterMode: ClusterMode = 'READ_WRITE';
  private witnessReachable = true;
  private activePeerNodes = new Set<string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastWitnessCheckAt = Date.now();

  constructor(
    @Optional() private readonly redis?: RedisService,
    @Optional() config?: Partial<QuorumWitnessConfig>,
  ) {
    this.nodeId = process.env.POD_NAME || `node-${Math.random().toString(36).substring(2, 9)}`;
    this.totalExpectedNodes = config?.totalExpectedNodes ?? 3;
    this.heartbeatIntervalMs = config?.heartbeatIntervalMs ?? 3000;
    this.nodeTtlSeconds = config?.nodeTtlSeconds ?? 10;
    this.witnessKeyPrefix = config?.witnessKeyPrefix ?? 'cluster:witness';

    // Self-register in active peers set initially
    this.activePeerNodes.add(this.nodeId);
  }

  public onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public setTotalExpectedNodes(nodes: number): void {
    this.totalExpectedNodes = Math.max(1, nodes);
    this.evaluateQuorum();
  }

  public getQuorumThreshold(): number {
    return Math.floor(this.totalExpectedNodes / 2) + 1;
  }

  public getClusterMode(): ClusterMode {
    return this.clusterMode;
  }

  public isWitnessReachable(): boolean {
    return this.witnessReachable;
  }

  public setWitnessReachable(reachable: boolean): void {
    this.witnessReachable = reachable;
    this.lastWitnessCheckAt = Date.now();
    this.evaluateQuorum();
  }

  /**
   * Directly registers peer nodes (useful in testing or consensus gossip).
   */
  public updateActivePeers(nodeIds: string[]): void {
    this.activePeerNodes = new Set(nodeIds);
    this.activePeerNodes.add(this.nodeId);
    this.evaluateQuorum();
  }

  /**
   * Calculates whether the current node belongs to the authoritative majority partition.
   */
  public hasQuorum(): boolean {
    if (!this.witnessReachable) {
      return false;
    }
    const reachableCount = this.activePeerNodes.size;
    const required = this.getQuorumThreshold();
    return reachableCount >= required;
  }

  /**
   * Enforces that stateful mutations (e.g. battle match completion, rating updates)
   * can only proceed if the current node is in majority partition with witness quorum.
   * Throws 503 ServiceUnavailableException if partitioned.
   */
  public assertMutationAllowed(): void {
    if (!this.hasQuorum() || this.clusterMode === 'READ_ONLY_SAFE_MODE') {
      const reachable = this.activePeerNodes.size;
      const threshold = this.getQuorumThreshold();
      this.logger.warn(
        `[Split-Brain Guard] Mutation rejected: minority partition detected. Reachable pods: ${reachable}/${threshold} required.`,
      );
      throw new ServiceUnavailableException(
        `Cluster partition detected: node ${this.nodeId} is in minority partition (read-only safe mode). Quorum not achieved (${reachable}/${this.totalExpectedNodes} reachable, ${threshold} required).`,
      );
    }
  }

  /**
   * Health-checks the external Redis/etcd witness node and updates cluster membership.
   */
  public async checkWitnessHealth(): Promise<boolean> {
    try {
      const client = this.redis?.getClient();
      if (client) {
        const ping = await client.ping();
        this.witnessReachable = ping === 'PONG';
        this.lastWitnessCheckAt = Date.now();

        // Update own heartbeat in Redis witness store
        const nodeKey = `${this.witnessKeyPrefix}:node:${this.nodeId}`;
        await client.set(nodeKey, Date.now().toString(), 'EX', this.nodeTtlSeconds);

        // Fetch all active peer keys
        const keys = await client.keys(`${this.witnessKeyPrefix}:node:*`);
        this.activePeerNodes = new Set(
          keys.map((k: string) => k.replace(`${this.witnessKeyPrefix}:node:`, '')),
        );
      }
    } catch (err: unknown) {
      this.logger.debug(`Witness check failed, entering safe mode: ${String(err)}`);
      this.witnessReachable = false;
    }

    this.evaluateQuorum();
    return this.witnessReachable;
  }

  /**
   * Evaluates quorum state and automatically updates cluster mode between READ_WRITE and READ_ONLY_SAFE_MODE.
   */
  public evaluateQuorum(): ClusterMode {
    const quorumAchieved = this.hasQuorum();
    const prevMode = this.clusterMode;

    if (quorumAchieved) {
      this.clusterMode = 'READ_WRITE';
      if (prevMode !== 'READ_WRITE') {
        this.logger.log(
          `[Quorum Witness] Partition resolved! Restored READ_WRITE mode (${this.activePeerNodes.size}/${this.totalExpectedNodes} pods reachable).`,
        );
      }
    } else {
      this.clusterMode = 'READ_ONLY_SAFE_MODE';
      if (prevMode !== 'READ_ONLY_SAFE_MODE') {
        this.logger.warn(
          `[Quorum Witness] Split-Brain Alert: Switched to READ_ONLY_SAFE_MODE (${this.activePeerNodes.size}/${this.totalExpectedNodes} pods reachable, quorum=${this.getQuorumThreshold()}).`,
        );
      }
    }

    return this.clusterMode;
  }

  public getStatus(): ClusterQuorumStatus {
    return {
      nodeId: this.nodeId,
      clusterMode: this.clusterMode,
      reachableNodes: this.activePeerNodes.size,
      totalConfiguredNodes: this.totalExpectedNodes,
      quorumThreshold: this.getQuorumThreshold(),
      hasQuorum: this.hasQuorum(),
      witnessReachable: this.witnessReachable,
      lastWitnessCheckAt: this.lastWitnessCheckAt,
    };
  }
}
