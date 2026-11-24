import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ShardRouterMigrationService {
  private readonly logger = new Logger(ShardRouterMigrationService.name);
  private tenantToShard = new Map<string, string>(); // tenantId -> shardId

  public assignShard(tenantId: string, shardId: string): void {
    this.tenantToShard.set(tenantId, shardId);
  }

  public getShard(tenantId: string): string {
    return this.tenantToShard.get(tenantId) || 'shard-default';
  }

  public migrateTenantShard(tenantId: string, targetShard: string): { success: boolean; fromShard: string; toShard: string } {
    const from = this.getShard(tenantId);
    this.tenantToShard.set(tenantId, targetShard);
    this.logger.log(`Migrated tenant ${tenantId} from ${from} to ${targetShard}`);
    return { success: true, fromShard: from, toShard: targetShard };
  }
}
