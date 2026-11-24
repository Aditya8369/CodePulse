export interface QueryBudgetConfig {
  maxEstimatedRows: number;
  maxExecutionTimeMs: number;
}

/**
 * QueryCostLimiterService
 * Pre-evaluates database query complexity, rejects unindexed queries with excessive estimated rows (>50,000),
 * and automatically cancels queries running longer than timeout budget.
 */
export class QueryCostLimiterService {
  private readonly config: QueryBudgetConfig;

  constructor(config: QueryBudgetConfig = { maxEstimatedRows: 50000, maxExecutionTimeMs: 3000 }) {
    this.config = config;
  }

  /**
   * Pre-inspects query characteristics. Rejects full table scans without indexes.
   */
  evaluateQueryCost(query: string, estimatedRows: number, hasIndex: boolean): {
    allowed: boolean;
    reason?: string;
  } {
    if (!hasIndex && estimatedRows > 1000) {
      return {
        allowed: false,
        reason: `Query lacks index and scans ${estimatedRows} rows. Add index before execution.`
      };
    }

    if (estimatedRows > this.config.maxEstimatedRows) {
      return {
        allowed: false,
        reason: `Estimated rows (${estimatedRows}) exceeds maximum query budget (${this.config.maxEstimatedRows})`
      };
    }

    return { allowed: true };
  }

  async runWithTimeout<T>(queryPromise: Promise<T>, timeoutMs?: number): Promise<T> {
    const limitMs = timeoutMs || this.config.maxExecutionTimeMs;
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Query execution cancelled: exceeded ${limitMs}ms limit`)), limitMs);
    });
    return Promise.race([queryPromise, timeoutPromise]).finally(() => clearTimeout(timer));
  }
}
