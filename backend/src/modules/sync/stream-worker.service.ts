import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { RedisStreamsService, StreamMessage } from '../../common/redis/redis-streams.service';
import { SyncService } from './sync.service';

export interface SyncStreamEventPayload {
  userId: string;
  triggeredBy?: string;
  source?: string;
  timestamp?: number;
}

export interface WorkerHealthStatus {
  consumerName: string;
  stream: string;
  group: string;
  isRunning: boolean;
  processedCount: number;
  recoveredCount: number;
  lastActive: Date;
}

@Injectable()
export class StreamWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamWorkerService.name);
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private autoClaimTimer: NodeJS.Timeout | null = null;

  // Stream & Consumer Group Configuration
  private readonly stream = RedisStreamsService.STREAM_EVENTS_SYNC;
  private readonly group = RedisStreamsService.GROUP_WORKERS_SYNC;
  private readonly consumerName: string;
  private readonly idleThresholdMs = 60000; // 60 seconds failover threshold

  // Worker metrics
  private processedCount = 0;
  private recoveredCount = 0;
  private lastActive = new Date();

  constructor(
    private readonly redisStreams: RedisStreamsService,
    @Optional() private readonly syncService?: SyncService,
  ) {
    // Unique consumer pod name: stream-worker-<PID>-<randomHex>
    const randomHex = Math.random().toString(16).substring(2, 8);
    this.consumerName = `worker-pod-${process.pid}-${randomHex}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      // 1. Ensure stream and consumer group exist
      await this.redisStreams.ensureConsumerGroup(
        this.stream,
        this.group,
        '$',
      );

      // 2. Start polling for stream messages
      this.startProcessingLoop();

      // 3. Start auto-claim loop to recover dead worker partitions every 30s
      this.startAutoClaimLoop();

      this.logger.log(
        `StreamWorkerService started as consumer '${this.consumerName}' on stream '${this.stream}' group '${this.group}'`,
      );
    } catch (err: any) {
      this.logger.warn(
        `StreamWorkerService initialization deferred: ${err.message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stop();
  }

  /**
   * Starts event polling loop.
   */
  startProcessingLoop(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.scheduleNextPoll(100);
  }

  /**
   * Stops worker processing loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.autoClaimTimer) {
      clearInterval(this.autoClaimTimer);
      this.autoClaimTimer = null;
    }
  }

  private scheduleNextPoll(delayMs = 1000): void {
    if (!this.isRunning) {
      return;
    }
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAndProcess();
      } catch (err: any) {
        this.logger.error(`Error in StreamWorker loop: ${err.message}`);
      } finally {
        if (this.isRunning) {
          this.scheduleNextPoll(500);
        }
      }
    }, delayMs);
  }

  /**
   * Reads new messages assigned to this consumer, executes user sync, and acknowledges with XACK.
   */
  async pollAndProcess(): Promise<number> {
    this.lastActive = new Date();

    const readResults = await this.redisStreams.xreadgroup<SyncStreamEventPayload>(
      this.group,
      this.consumerName,
      [this.stream],
      ['>'],
      10, // Process in batches of 10
      0,  // Non-blocking in interval timer
    );

    let count = 0;
    for (const result of readResults) {
      for (const msg of result.messages) {
        await this.processMessage(msg);
        count++;
      }
    }

    return count;
  }

  /**
   * Processes an individual stream message and sends XACK upon success.
   */
  async processMessage(msg: StreamMessage<SyncStreamEventPayload>): Promise<void> {
    try {
      const { userId } = msg.data;
      if (userId && this.syncService) {
        await this.syncService.syncUser(userId);
      }

      // Acknowledge after successful processing to guarantee at-least-once delivery
      await this.redisStreams.xack(this.stream, this.group, msg.id);
      this.processedCount++;
    } catch (err: any) {
      this.logger.error(
        `Failed processing stream message '${msg.id}' for user '${msg.data?.userId}': ${err.message}`,
      );
      // Not acknowledged: message will remain pending and eligible for retry or auto-claim
    }
  }

  /**
   * Periodically scans for messages that timed out on crashed or dead workers (> 60s)
   * and auto-claims them via XCLAIM.
   */
  startAutoClaimLoop(): void {
    this.autoClaimTimer = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }
      try {
        await this.claimOrphanedMessages();
      } catch (err: any) {
        this.logger.warn(`Auto-claim loop failed: ${err.message}`);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Detects pending messages whose idle time exceeds 60s and reclaims them.
   */
  async claimOrphanedMessages(): Promise<number> {
    const claimed = await this.redisStreams.autoClaimDeadWorkerMessages<SyncStreamEventPayload>(
      this.stream,
      this.group,
      this.consumerName,
      this.idleThresholdMs, // 60s
      20,
    );

    if (claimed.length > 0) {
      this.recoveredCount += claimed.length;
      this.logger.log(
        `Worker '${this.consumerName}' successfully reclaimed ${claimed.length} abandoned messages from crashed workers`,
      );

      // Process reclaimed messages immediately
      for (const msg of claimed) {
        await this.processMessage(msg);
      }
    }

    return claimed.length;
  }

  /**
   * Publishes a new sync event onto the persistent event stream.
   */
  async publishSyncEvent(userId: string, source: string = 'api'): Promise<string> {
    return this.redisStreams.xadd(this.stream, {
      userId,
      source,
      timestamp: Date.now(),
    });
  }

  /**
   * Health and diagnostics reporting for Prometheus / Health endpoints.
   */
  getHealth(): WorkerHealthStatus {
    return {
      consumerName: this.consumerName,
      stream: this.stream,
      group: this.group,
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      recoveredCount: this.recoveredCount,
      lastActive: this.lastActive,
    };
  }

  getConsumerName(): string {
    return this.consumerName;
  }
}

