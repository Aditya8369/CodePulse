import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { PartitionMetadata, PartitionTableDef, PartitioningMetrics } from './range-partitioning.types';

@Injectable()
export class RangePartitioningService implements OnModuleDestroy {
  private readonly logger = new Logger(RangePartitioningService.name);

  private readonly managedTables = new Map<string, PartitionTableDef>();
  private readonly partitions = new Map<string, PartitionMetadata[]>();
  private totalPruned = 0;
  private lastCreatedName = '';

  constructor(@Optional() defs?: PartitionTableDef[]) {
    const defaultDefs: PartitionTableDef[] = defs ?? [
      { tableName: 'audit_logs', partitionColumn: 'created_at', interval: 'MONTHLY', retentionMonths: 6 },
      { tableName: 'submissions', partitionColumn: 'submitted_at', interval: 'MONTHLY', retentionMonths: 12 },
    ];
    for (const def of defaultDefs) {
      this.managedTables.set(def.tableName, def);
      this.partitions.set(def.tableName, []);
    }
  }

  public onModuleDestroy(): void {
    this.managedTables.clear();
    this.partitions.clear();
  }

  /**
   * Generates next N monthly declarative range partitions ahead of time.
   */
  public ensureUpcomingPartitions(tableName: string, monthsAhead = 2): PartitionMetadata[] {
    const def = this.managedTables.get(tableName);
    if (!def) {
      throw new Error(`Table ${tableName} is not registered for range partitioning.`);
    }

    const list = this.partitions.get(tableName) ?? [];
    const created: PartitionMetadata[] = [];
    const now = new Date();

    for (let i = 0; i < monthsAhead; i++) {
      const year = now.getFullYear();
      const month = now.getMonth() + 1 + i;
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));

      const partName = `${tableName}_y${start.getUTCFullYear()}m${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

      if (!list.some((p) => p.partitionName === partName)) {
        const metadata: PartitionMetadata = {
          partitionName: partName,
          parentTable: tableName,
          rangeStart: start.toISOString(),
          rangeEnd: end.toISOString(),
          createdAt: Date.now(),
          rowCount: 0,
          isPruned: false,
        };
        list.push(metadata);
        created.push(metadata);
        this.lastCreatedName = partName;
        this.logger.log(`[RangePartitioning] Created declarative partition ${partName} [${start.toISOString()} to ${end.toISOString()}]`);
      }
    }

    this.partitions.set(tableName, list);
    return created;
  }

  /**
   * Automatically prunes partitions older than configured retention period.
   */
  public pruneExpiredPartitions(tableName: string): number {
    const def = this.managedTables.get(tableName);
    if (!def) return 0;

    const list = this.partitions.get(tableName) ?? [];
    const retentionDate = new Date();
    retentionDate.setMonth(retentionDate.getMonth() - def.retentionMonths);

    let prunedInRun = 0;
    for (const part of list) {
      if (!part.isPruned && new Date(part.rangeEnd) < retentionDate) {
        part.isPruned = true;
        prunedInRun++;
        this.totalPruned++;
        this.logger.log(`[RangePartitioning] Pruned partition ${part.partitionName} (expired ${part.rangeEnd} < ${retentionDate.toISOString()})`);
      }
    }

    return prunedInRun;
  }

  public getPartitions(tableName: string): PartitionMetadata[] {
    return this.partitions.get(tableName) ?? [];
  }

  public getMetrics(): PartitioningMetrics {
    let active = 0;
    for (const list of this.partitions.values()) {
      active += list.filter((p) => !p.isPruned).length;
    }

    return {
      totalPartitionsActive: active,
      totalPartitionsPruned: this.totalPruned,
      lastPartitionCreated: this.lastCreatedName,
      managedTablesCount: this.managedTables.size,
    };
  }
}
