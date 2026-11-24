import { Injectable } from '@nestjs/common';

export interface ShardChunkMetadata {
  shardId: string;
  chunkCount: number;
  dataSizeBytes: number;
}

@Injectable()
export class MongodbClusterBalancerService {
  private readonly maxChunkImbalance = 8;

  public shouldTriggerBalance(shards: ShardChunkMetadata[]): { needsBalance: boolean; sourceShard?: string; targetShard?: string } {
    if (shards.length < 2) return { needsBalance: false };

    let minShard = shards[0];
    let maxShard = shards[0];

    for (const s of shards) {
      if (s.chunkCount < minShard.chunkCount) minShard = s;
      if (s.chunkCount > maxShard.chunkCount) maxShard = s;
    }

    if (maxShard.chunkCount - minShard.chunkCount >= this.maxChunkImbalance) {
      return { needsBalance: true, sourceShard: maxShard.shardId, targetShard: minShard.shardId };
    }

    return { needsBalance: false };
  }
}
