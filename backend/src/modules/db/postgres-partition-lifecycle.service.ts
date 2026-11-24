export interface PartitionRange {
  tableName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export class PostgresPartitionLifecycleService {
  private activePartitions = new Set<string>();

  public generatePartitionName(table: string, year: number, month: number): string {
    return `${table}_y${year}m${String(month).padStart(2, '0')}`;
  }

  public registerPartition(name: string): void {
    this.activePartitions.add(name);
  }

  public planPartitions(table: string, currentYear: number, currentMonth: number, lookaheadMonths: number = 2): string[] {
    const planned: string[] = [];
    for (let i = 0; i <= lookaheadMonths; i++) {
      let m = currentMonth + i;
      let y = currentYear;
      if (m > 12) {
        m -= 12;
        y++;
      }
      const pName = this.generatePartitionName(table, y, m);
      planned.push(pName);
    }
    return planned;
  }
}
