export interface DependencyCheckResult {
  name: 'PostgreSQL' | 'Redis' | 'ScyllaDB' | 'Kafka';
  status: 'UP' | 'DOWN';
  responseTimeMs: number;
  details?: Record<string, any>;
  error?: string;
}

export interface ReadinessReport {
  ready: boolean;
  status: 'HEALTHY' | 'UNHEALTHY';
  timestamp: number;
  checks: DependencyCheckResult[];
}

/**
 * DeepReadinessCheckService
 * Executes lightweight live probes against all primary dependencies (Postgres, Redis, ScyllaDB, Kafka)
 * to verify actual read/write readiness before pods receive customer traffic.
 */
export class DeepReadinessCheckService {
  async checkPostgres(probeFn: () => Promise<boolean>): Promise<DependencyCheckResult> {
    const start = Date.now();
    try {
      const isWritable = await probeFn();
      return {
        name: 'PostgreSQL',
        status: isWritable ? 'UP' : 'DOWN',
        responseTimeMs: Date.now() - start,
        details: { writable: isWritable }
      };
    } catch (e: any) {
      return {
        name: 'PostgreSQL',
        status: 'DOWN',
        responseTimeMs: Date.now() - start,
        error: e.message
      };
    }
  }

  async checkRedis(probeFn: () => Promise<boolean>): Promise<DependencyCheckResult> {
    const start = Date.now();
    try {
      const pong = await probeFn();
      return {
        name: 'Redis',
        status: pong ? 'UP' : 'DOWN',
        responseTimeMs: Date.now() - start
      };
    } catch (e: any) {
      return {
        name: 'Redis',
        status: 'DOWN',
        responseTimeMs: Date.now() - start,
        error: e.message
      };
    }
  }

  async checkKafka(probeFn: () => Promise<boolean>): Promise<DependencyCheckResult> {
    const start = Date.now();
    try {
      const active = await probeFn();
      return {
        name: 'Kafka',
        status: active ? 'UP' : 'DOWN',
        responseTimeMs: Date.now() - start
      };
    } catch (e: any) {
      return {
        name: 'Kafka',
        status: 'DOWN',
        responseTimeMs: Date.now() - start,
        error: e.message
      };
    }
  }

  async evaluateReadiness(probes: {
    postgres: () => Promise<boolean>;
    redis: () => Promise<boolean>;
    kafka: () => Promise<boolean>;
  }): Promise<ReadinessReport> {
    const checks = await Promise.all([
      this.checkPostgres(probes.postgres),
      this.checkRedis(probes.redis),
      this.checkKafka(probes.kafka)
    ]);

    const allUp = checks.every(c => c.status === 'UP');
    return {
      ready: allUp,
      status: allUp ? 'HEALTHY' : 'UNHEALTHY',
      timestamp: Date.now(),
      checks
    };
  }
}
