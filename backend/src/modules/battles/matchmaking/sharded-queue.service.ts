import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';

export interface MatchmakingTicket {
  ticketId: string;
  userId: string;
  username: string;
  elo: number;
  region: string;
  category: string;
  joinedAt: number;
  currentEloWindow: number; // starts at 25, expands by 25 every 5s
  matchedWith?: string;
  isBotMatch?: boolean;
}

export interface MatchResult {
  matchId: string;
  player1: MatchmakingTicket;
  player2?: MatchmakingTicket;
  shardId: string;
  eloDifference: number;
  isBotMatch: boolean;
  createdAt: number;
}

interface VirtualNode {
  hash: number;
  shardId: string;
}

@Injectable()
export class ShardedMatchmakingQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ShardedMatchmakingQueueService.name);

  // Consistent Hash Ring
  private readonly ring: VirtualNode[] = [];
  private readonly shards: string[] = ['shard-0', 'shard-1', 'shard-2', 'shard-3'];
  public static readonly VIRTUAL_NODES_PER_SHARD = 128; // 128 virtual nodes per shard

  // Per-shard queues
  private readonly shardQueues = new Map<string, MatchmakingTicket[]>();
  // Matched player lock to prevent race conditions / duplicate matches
  private readonly matchedPlayers = new Set<string>();

  // Expansion and tick loop
  private expansionInterval: NodeJS.Timeout | null = null;
  public static readonly BRACKET_EXPANSION_INTERVAL_MS = 5000;
  public static readonly ELO_EXPANSION_STEP = 25; // ±25 ELO every 5 seconds
  public static readonly MAX_WAIT_TIME_MS = 30000; // Capped at 30s before bot fallback

  constructor(@Optional() private readonly redis?: RedisService) {
    this.buildHashRing();
    this.shards.forEach((s) => this.shardQueues.set(s, []));
  }

  public onModuleDestroy(): void {
    if (this.expansionInterval) {
      clearInterval(this.expansionInterval);
      this.expansionInterval = null;
    }
  }

  /**
   * Builds consistent hash ring using 128 virtual nodes per shard.
   */
  private buildHashRing(): void {
    this.ring.length = 0;
    for (const shardId of this.shards) {
      for (let i = 0; i < ShardedMatchmakingQueueService.VIRTUAL_NODES_PER_SHARD; i++) {
        const hash = this.hashKey(`${shardId}#vn_${i}`);
        this.ring.push({ hash, shardId });
      }
    }
    // Sort ring in ascending order of 32-bit hash
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  private hashKey(key: string): number {
    const md5 = crypto.createHash('md5').update(key).digest();
    return md5.readUInt32BE(0);
  }

  /**
   * Maps an ELO and Region key to its responsible shard via the consistent hash ring.
   */
  public getShardFor(region: string, eloBucket: number): string {
    const key = `${region.toUpperCase()}:${Math.floor(eloBucket / 50) * 50}`;
    const keyHash = this.hashKey(key);

    // Binary search on ring
    let low = 0;
    let high = this.ring.length - 1;
    let target = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].hash >= keyHash) {
        target = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return this.ring[target % this.ring.length].shardId;
  }

  /**
   * Enqueues a player with O(1) queue insertion into their hashed shard.
   */
  public enqueue(
    userId: string,
    username: string,
    elo: number,
    region = 'US-EAST',
    category = 'General',
  ): { ticket: MatchmakingTicket; shardId: string } {
    if (this.matchedPlayers.has(userId)) {
      this.matchedPlayers.delete(userId);
    }

    const shardId = this.getShardFor(region, elo);
    const queue = this.shardQueues.get(shardId) || [];

    // Remove if already in queue
    const filtered = queue.filter((t) => t.userId !== userId);

    const ticket: MatchmakingTicket = {
      ticketId: `tkt_${Date.now()}_${userId}`,
      userId,
      username,
      elo,
      region,
      category,
      joinedAt: Date.now(),
      currentEloWindow: ShardedMatchmakingQueueService.ELO_EXPANSION_STEP,
    };

    filtered.push(ticket);
    this.shardQueues.set(shardId, filtered);

    return { ticket, shardId };
  }

  /**
   * Evaluates matchmaking pairings in a shard with anti-starvation expansion and bot fallback.
   */
  public findMatchesInShard(shardId: string): MatchResult[] {
    const queue = this.shardQueues.get(shardId) || [];
    if (queue.length === 0) return [];

    const matches: MatchResult[] = [];
    const remainingQueue: MatchmakingTicket[] = [];
    const now = Date.now();

    // Sort by joinedAt ascending (FIFO prioritization)
    queue.sort((a, b) => a.joinedAt - b.joinedAt);

    const processedInBatch = new Set<string>();

    for (let i = 0; i < queue.length; i++) {
      const p1 = queue[i];
      if (processedInBatch.has(p1.userId) || this.matchedPlayers.has(p1.userId)) {
        continue;
      }

      const waitDuration = now - p1.joinedAt;

      // Update anti-starvation bucket expansion: +25 ELO per 5s elapsed
      const expandedWindows = Math.floor(
        waitDuration / ShardedMatchmakingQueueService.BRACKET_EXPANSION_INTERVAL_MS,
      );
      p1.currentEloWindow =
        ShardedMatchmakingQueueService.ELO_EXPANSION_STEP * (expandedWindows + 1);

      // Check max wait time cap (30s) -> Bot fallback
      if (waitDuration >= ShardedMatchmakingQueueService.MAX_WAIT_TIME_MS) {
        processedInBatch.add(p1.userId);
        this.matchedPlayers.add(p1.userId);

        matches.push({
          matchId: `match_bot_${Date.now()}_${p1.userId}`,
          player1: p1,
          shardId,
          eloDifference: 0,
          isBotMatch: true,
          createdAt: now,
        });
        continue;
      }

      // Search for best opponent in queue within mutual ELO window
      let bestOpponentIdx = -1;
      let minEloDiff = Infinity;

      for (let j = i + 1; j < queue.length; j++) {
        const p2 = queue[j];
        if (processedInBatch.has(p2.userId) || this.matchedPlayers.has(p2.userId)) {
          continue;
        }

        const eloDiff = Math.abs(p1.elo - p2.elo);
        const maxAllowed = Math.max(p1.currentEloWindow, p2.currentEloWindow);

        if (eloDiff <= maxAllowed && eloDiff < minEloDiff) {
          minEloDiff = eloDiff;
          bestOpponentIdx = j;
        }
      }

      if (bestOpponentIdx !== -1) {
        const p2 = queue[bestOpponentIdx];
        processedInBatch.add(p1.userId);
        processedInBatch.add(p2.userId);
        this.matchedPlayers.add(p1.userId);
        this.matchedPlayers.add(p2.userId);

        matches.push({
          matchId: `match_${Date.now()}_${p1.userId}_${p2.userId}`,
          player1: p1,
          player2: p2,
          shardId,
          eloDifference: Math.abs(p1.elo - p2.elo),
          isBotMatch: false,
          createdAt: now,
        });
      } else {
        remainingQueue.push(p1);
      }
    }

    this.shardQueues.set(shardId, remainingQueue);
    return matches;
  }

  /**
   * Runs match evaluation across all shards.
   */
  public processAllShards(): MatchResult[] {
    const allMatches: MatchResult[] = [];
    for (const shardId of this.shards) {
      const shardMatches = this.findMatchesInShard(shardId);
      allMatches.push(...shardMatches);
    }
    return allMatches;
  }

  public getQueueLength(shardId?: string): number {
    if (shardId) {
      return this.shardQueues.get(shardId)?.length || 0;
    }
    let total = 0;
    this.shardQueues.forEach((q) => (total += q.length));
    return total;
  }

  public clear(): void {
    this.shardQueues.forEach((q) => (q.length = 0));
    this.matchedPlayers.clear();
  }
}
