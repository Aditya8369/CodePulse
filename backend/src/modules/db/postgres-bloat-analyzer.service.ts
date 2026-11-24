export interface TableBloatStats {
  tableName: string;
  liveTuples: number;
  deadTuples: number;
  bloatRatio: number;
  defragRecommended: boolean;
}

export class PostgresBloatAnalyzerService {
  private thresholdRatio: number;

  constructor(thresholdRatio: number = 0.2) {
    this.thresholdRatio = thresholdRatio;
  }

  public evaluateTable(tableName: string, liveTuples: number, deadTuples: number): TableBloatStats {
    const total = liveTuples + deadTuples;
    const bloatRatio = total > 0 ? deadTuples / total : 0;
    return {
      tableName,
      liveTuples,
      deadTuples,
      bloatRatio: Math.round(bloatRatio * 100) / 100,
      defragRecommended: bloatRatio >= this.thresholdRatio
    };
  }
}
