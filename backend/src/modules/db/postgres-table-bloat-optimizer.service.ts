import { Injectable } from '@nestjs/common';

export interface TableBloatMetrics {
  tableName: string;
  liveTuples: number;
  deadTuples: number;
}

@Injectable()
export class PostgresTableBloatOptimizerService {
  private readonly bloatRatioThreshold = 0.2; // 20% dead tuples threshold

  public shouldVacuumTable(table: TableBloatMetrics): { vacuumNeeded: boolean; deadRatio: number } {
    const total = table.liveTuples + table.deadTuples;
    if (total === 0) return { vacuumNeeded: false, deadRatio: 0 };
    const ratio = table.deadTuples / total;
    return { vacuumNeeded: ratio >= this.bloatRatioThreshold, deadRatio: Math.round(ratio * 100) / 100 };
  }
}
