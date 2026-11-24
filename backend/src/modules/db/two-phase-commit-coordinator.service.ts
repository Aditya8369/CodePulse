export interface ShardParticipant {
  shardId: string;
  prepare: () => Promise<boolean>;
  commit: () => Promise<boolean>;
  rollback: () => Promise<boolean>;
}

export class TwoPhaseCommitCoordinatorService {
  public async execute2PC(shards: ShardParticipant[]): Promise<{ success: boolean; state: 'COMMITTED' | 'ABORTED' }> {
    const preparedShards: ShardParticipant[] = [];

    // Phase 1: Prepare
    for (const shard of shards) {
      try {
        const ok = await shard.prepare();
        if (ok) {
          preparedShards.push(shard);
        } else {
          // Abort all
          await this.abort(preparedShards);
          return { success: false, state: 'ABORTED' };
        }
      } catch (e) {
        await this.abort(preparedShards);
        return { success: false, state: 'ABORTED' };
      }
    }

    // Phase 2: Commit
    for (const shard of preparedShards) {
      await shard.commit();
    }

    return { success: true, state: 'COMMITTED' };
  }

  private async abort(shards: ShardParticipant[]): Promise<void> {
    for (const shard of shards) {
      await shard.rollback();
    }
  }
}
