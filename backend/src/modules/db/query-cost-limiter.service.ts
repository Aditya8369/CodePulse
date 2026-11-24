export class QueryCostLimiterService {
  private maxCostBudget: number;

  constructor(maxCostBudget: number = 1000) {
    this.maxCostBudget = maxCostBudget;
  }

  public estimateCost(sql: string): number {
    let cost = 10;
    const lower = sql.toLowerCase();
    if (lower.includes('join')) cost += 100;
    if (lower.includes('cross join')) cost += 800;
    if (lower.includes('order by') && !lower.includes('limit')) cost += 300;
    if (lower.includes('select *') && !lower.includes('limit')) cost += 200;
    return cost;
  }

  public shouldAllow(sql: string): { allowed: boolean; estimatedCost: number; reason?: string } {
    const estimatedCost = this.estimateCost(sql);
    if (estimatedCost > this.maxCostBudget) {
      return {
        allowed: false,
        estimatedCost,
        reason: `Query cost ${estimatedCost} exceeds budget ${this.maxCostBudget}`
      };
    }
    return { allowed: true, estimatedCost };
  }
}
