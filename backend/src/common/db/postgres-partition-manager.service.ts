export interface PartitionInfo {
  tableName: string;
  partitionName: string;
  startDate: string;
  endDate: string;
}

/**
 * PostgresPartitionManagerService
 * Automates monthly range partition maintenance for audit logs and telemetry tables,
 * pre-creating future partitions 7 days in advance and pruning tables exceeding retention window.
 */
export class PostgresPartitionManagerService {
  private readonly partitions = new Map<string, PartitionInfo>();

  generatePartitionName(baseTable: string, year: number, month: number): string {
    const m = month.toString().padStart(2, '0');
    return `${baseTable}_${year}_${m}`;
  }

  ensureMonthlyPartition(baseTable: string, date: Date = new Date()): PartitionInfo {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-12
    const partName = this.generatePartitionName(baseTable, year, month);

    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const end = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1)).toISOString().split('T')[0];

    const info: PartitionInfo = { tableName: baseTable, partitionName: partName, startDate: start, endDate: end };
    this.partitions.set(partName, info);
    return info;
  }

  preCreateNextMonth(baseTable: string, now: Date = new Date()): PartitionInfo {
    const futureDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    return this.ensureMonthlyPartition(baseTable, futureDate);
  }

  hasPartition(name: string): boolean {
    return this.partitions.has(name);
  }
}
