export class PrismaPoolLatencyInterceptorService {
  private slowQueryThresholdMs: number = 500;
  private slowQueries: { query: string; durationMs: number; timestamp: number }[] = [];

  public async trackQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await queryFn();
    } finally {
      const durationMs = Date.now() - start;
      if (durationMs > this.slowQueryThresholdMs) {
        this.slowQueries.push({ query: queryName, durationMs, timestamp: start });
      }
    }
  }

  public getSlowQueries(): { query: string; durationMs: number; timestamp: number }[] {
    return [...this.slowQueries];
  }
}
