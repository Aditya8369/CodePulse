import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { OpenMetricsContentType } from 'prom-client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry = new Registry<OpenMetricsContentType>();
  private readonly connections = new Set<string>();
  private readonly httpDuration: Histogram<'method' | 'route' | 'status_code'>;
  private readonly activeConnections: Gauge;
  private readonly activeBattles: Gauge;
  private readonly waitingJobs: Gauge<'queue'>;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('challenges') private readonly challenges: Queue,
    @InjectQueue('leaderboard-sync') private readonly leaderboardSync: Queue,
    @InjectQueue('github-sync') private readonly githubSync: Queue,
    @InjectQueue('dead-letter') private readonly deadLetter: Queue,
  ) {
    this.registry.setContentType(Registry.OPENMETRICS_CONTENT_TYPE);
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
    this.activeConnections = new Gauge({
      name: 'ws_active_connections_total',
      help: 'Current connected battle WebSocket clients',
      registers: [this.registry],
    });
    this.activeBattles = new Gauge({
      name: 'battles_active_total',
      help: 'Current active battles in the database',
      registers: [this.registry],
      collect: async () => {
        try {
          this.activeBattles.set(
            await this.prisma.battle.count({ where: { status: 'ACTIVE' } }),
          );
        } catch (error) {
          this.logger.warn(
            `Could not collect active battle count: ${String(error)}`,
          );
        }
      },
    });
    this.waitingJobs = new Gauge<'queue'>({
      name: 'bullmq_queue_waiting_jobs',
      help: 'Current waiting jobs by configured BullMQ queue',
      labelNames: ['queue'],
      registers: [this.registry],
      collect: async () => {
        const queues: Array<[string, Queue]> = [
          ['challenges', this.challenges],
          ['leaderboard-sync', this.leaderboardSync],
          ['github-sync', this.githubSync],
          ['dead-letter', this.deadLetter],
        ];
        for (const [name, queue] of queues) {
          try {
            this.waitingJobs.set(
              { queue: name },
              await queue.getWaitingCount(),
            );
          } catch (error) {
            this.logger.warn(
              `Could not collect ${name} queue depth: ${String(error)}`,
            );
          }
        }
      },
    });
    this.activeConnections.set(0);
  }

  recordHttp(
    method: string,
    route: string,
    statusCode: number,
    seconds: number,
  ): void {
    this.httpDuration.observe(
      { method, route, status_code: String(statusCode) },
      seconds,
    );
  }

  socketConnected(id: string): void {
    this.connections.add(id);
    this.activeConnections.set(this.connections.size);
  }

  socketDisconnected(id: string): void {
    this.connections.delete(id);
    this.activeConnections.set(this.connections.size);
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
