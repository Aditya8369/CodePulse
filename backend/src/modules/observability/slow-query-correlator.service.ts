export interface QueryContext {
  userId?: string;
  endpoint: string;
  durationMs: number;
  sqlQuery: string;
}

export class SlowQueryCorrelatorService {
  public formatLog(context: QueryContext): string {
    return JSON.stringify({
      level: 'WARN',
      type: 'SLOW_QUERY',
      endpoint: context.endpoint,
      userId: context.userId || 'anonymous',
      durationMs: context.durationMs,
      sql: context.sqlQuery
    });
  }
}
