import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface StreamMessage<T = Record<string, string>> {
  id: string;
  data: T;
}

export interface StreamReadResult<T = Record<string, string>> {
  stream: string;
  messages: StreamMessage<T>[];
}

export interface PendingMessageSummary {
  id: string;
  consumer: string;
  idleTimeMs: number;
  deliveryCount: number;
}

export interface StreamGroupLagInfo {
  stream: string;
  group: string;
  pendingCount: number;
  lastDeliveredId: string;
  consumersCount: number;
  lag: number;
}

export interface RedisStreamsConfig {
  host?: string;
  port?: number;
  password?: string;
  defaultMaxLen?: number;
}

@Injectable()
export class RedisStreamsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisStreamsService.name);
  private client: Redis | null = null;
  private readonly defaultMaxLen: number = 100000;

  // Well-known standard application streams and consumer groups
  public static readonly STREAM_EVENTS_SYNC = 'stream:events:sync';
  public static readonly STREAM_EVENTS_BATTLES = 'stream:events:battles';
  public static readonly GROUP_WORKERS_SYNC = 'cg:workers:sync';
  public static readonly GROUP_WORKERS_BATTLES = 'cg:workers:battles';

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() customClient?: Redis,
  ) {
    if (customClient) {
      this.client = customClient;
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.client) {
      return;
    }

    const host =
      this.configService?.get<string>('REDIS_HOST') ||
      process.env.REDIS_HOST ||
      'localhost';
    const port = parseInt(
      this.configService?.get<string>('REDIS_PORT') ||
        process.env.REDIS_PORT ||
        '6379',
      10,
    );
    const password =
      this.configService?.get<string>('REDIS_PASSWORD') ||
      process.env.REDIS_PASSWORD ||
      undefined;

    try {
      this.client = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });

      this.client.on('error', (err) => {
        this.logger.warn(`RedisStreamsService connection warning: ${err.message}`);
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(
          `Redis instance not reachable for RedisStreamsService (${err.message}). In-memory mode / graceful degradation activated.`,
        );
      });
    } catch (err: any) {
      this.logger.warn(
        `Failed to initialize Redis client in RedisStreamsService: ${err.message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // Ignore disconnection errors during teardown
      }
      this.client = null;
    }
  }

  /**
   * Returns whether active Redis connection is healthy and ready.
   */
  isHealthy(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * Sets custom Redis instance (useful for unit testing and mocks).
   */
  setClient(client: Redis | null): void {
    this.client = client;
  }

  /**
   * Gets current underlying Redis client.
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Ensures persistent stream and consumer group exist.
   * If group already exists (BUSYGROUP), silently catches and succeeds.
   *
   * @param stream Name of the stream (e.g. stream:events:sync)
   * @param group Name of the consumer group (e.g. cg:workers:sync)
   * @param startId Redis stream ID to start from (default '$' for new messages, '0' for beginning)
   */
  async ensureConsumerGroup(
    stream: string,
    group: string,
    startId: string = '$',
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(`Redis unavailable: cannot create group ${group} on ${stream}`);
      return false;
    }

    try {
      // MKSTREAM creates the stream automatically if it doesn't exist
      await this.client.xgroup('CREATE', stream, group, startId, 'MKSTREAM');
      this.logger.log(`Created consumer group '${group}' on stream '${stream}'`);
      return true;
    } catch (err: any) {
      if (err.message && err.message.includes('BUSYGROUP')) {
        // Consumer group already exists - expected and safe
        return true;
      }
      this.logger.error(
        `Failed to create consumer group '${group}' on '${stream}': ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Appends an event to the stream with automatic MAXLEN trimming (~ 100,000).
   *
   * @param stream Stream key name
   * @param fields Key-value pairs of the event payload
   * @param maxLen Approximate maximum stream length to prevent unbounded memory growth
   * @returns Message ID generated by Redis
   */
  async xadd(
    stream: string,
    fields: Record<string, string | number | boolean>,
    maxLen: number = this.defaultMaxLen,
  ): Promise<string> {
    if (!this.client) {
      throw new Error(`Redis client not available for XADD on stream ${stream}`);
    }

    const fieldEntries: string[] = [];
    for (const [key, val] of Object.entries(fields)) {
      fieldEntries.push(key, typeof val === 'string' ? val : JSON.stringify(val));
    }

    // XADD stream MAXLEN ~ maxLen * k1 v1 k2 v2...
    const messageId = (await this.client.xadd(
      stream,
      'MAXLEN',
      '~',
      String(maxLen),
      '*',
      ...fieldEntries,
    )) as string;

    return messageId;
  }

  /**
   * Reads new or unacknowledged messages assigned to a consumer group using XREADGROUP.
   *
   * @param group Consumer group name
   * @param consumer Consumer worker name (e.g. worker-pod-1)
   * @param streams Stream names
   * @param ids Message IDs (typically '>' for brand-new messages, '0' for pending history)
   * @param count Max messages to read per stream
   * @param blockMs Timeout to block waiting for messages in ms (0 for non-blocking)
   */
  async xreadgroup<T = Record<string, string>>(
    group: string,
    consumer: string,
    streams: string[],
    ids: string[] = streams.map(() => '>'),
    count = 10,
    blockMs = 0,
  ): Promise<StreamReadResult<T>[]> {
    if (!this.client) {
      return [];
    }

    const args: (string | number)[] = [
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
    ];

    if (blockMs > 0) {
      args.push('BLOCK', blockMs);
    }

    args.push('STREAMS', ...streams, ...ids);

    try {
      const rawResult = (await (this.client as any).xreadgroup(...args)) as any;
      if (!rawResult || !Array.isArray(rawResult)) {
        return [];
      }

      return rawResult.map(([streamName, rawMessages]: [string, any[]]) => ({
        stream: streamName,
        messages: (rawMessages || []).map(([msgId, rawFields]: [string, string[]]) => {
          const parsedData: Record<string, any> = {};
          for (let i = 0; i < rawFields.length; i += 2) {
            const key = rawFields[i];
            const rawVal = rawFields[i + 1];
            try {
              parsedData[key] = JSON.parse(rawVal);
            } catch {
              parsedData[key] = rawVal;
            }
          }
          return {
            id: msgId,
            data: parsedData as T,
          };
        }),
      }));
    } catch (err: any) {
      this.logger.error(
        `XREADGROUP error for group '${group}', consumer '${consumer}': ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Acknowledges successfully processed messages from a consumer group (XACK).
   *
   * @param stream Stream name
   * @param group Consumer group name
   * @param messageIds Array of message IDs to acknowledge
   * @returns Number of messages acknowledged
   */
  async xack(stream: string, group: string, ...messageIds: string[]): Promise<number> {
    if (!this.client || messageIds.length === 0) {
      return 0;
    }

    return (await this.client.xack(stream, group, ...messageIds)) as number;
  }

  /**
   * Inspects pending unacknowledged messages in the consumer group (XPENDING).
   *
   * @param stream Stream name
   * @param group Consumer group name
   * @param start Message ID range start (default '-')
   * @param end Message ID range end (default '+')
   * @param count Max pending items to retrieve
   */
  async xpending(
    stream: string,
    group: string,
    start: string = '-',
    end: string = '+',
    count: number = 50,
  ): Promise<PendingMessageSummary[]> {
    if (!this.client) {
      return [];
    }

    try {
      // XPENDING <stream> <group> <start> <end> <count>
      const rawPending = (await (this.client as any).xpending(
        stream,
        group,
        start,
        end,
        count,
      )) as any[];

      if (!rawPending || !Array.isArray(rawPending)) {
        return [];
      }

      // Format: [ [id, consumer, idleTimeMs, deliveryCount], ... ]
      return rawPending.map((item) => ({
        id: item[0],
        consumer: item[1],
        idleTimeMs: Number(item[2]),
        deliveryCount: Number(item[3]),
      }));
    } catch (err: any) {
      this.logger.warn(`XPENDING failed on ${stream}/${group}: ${err.message}`);
      return [];
    }
  }

  /**
   * Reclaims messages that have been pending longer than minIdleTimeMs from crashed workers (XCLAIM).
   *
   * @param stream Stream name
   * @param group Consumer group name
   * @param claimingConsumer Current active consumer claiming ownership
   * @param minIdleTimeMs Minimum idle time in ms (e.g. 60,000ms for 60s crash detection)
   * @param messageIds Message IDs to claim
   */
  async xclaim<T = Record<string, string>>(
    stream: string,
    group: string,
    claimingConsumer: string,
    minIdleTimeMs: number,
    ...messageIds: string[]
  ): Promise<StreamMessage<T>[]> {
    if (!this.client || messageIds.length === 0) {
      return [];
    }

    try {
      // XCLAIM <stream> <group> <consumer> <min-idle-time> <ID-1> <ID-2> ...
      const rawClaimed = (await (this.client as any).xclaim(
        stream,
        group,
        claimingConsumer,
        minIdleTimeMs,
        ...messageIds,
      )) as any[];

      if (!rawClaimed || !Array.isArray(rawClaimed)) {
        return [];
      }

      return rawClaimed.map(([msgId, rawFields]: [string, string[]]) => {
        const parsedData: Record<string, any> = {};
        for (let i = 0; i < rawFields.length; i += 2) {
          const key = rawFields[i];
          const rawVal = rawFields[i + 1];
          try {
            parsedData[key] = JSON.parse(rawVal);
          } catch {
            parsedData[key] = rawVal;
          }
        }
        return {
          id: msgId,
          data: parsedData as T,
        };
      });
    } catch (err: any) {
      this.logger.error(
        `XCLAIM failed for consumer '${claimingConsumer}' on ${stream}: ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Discovers and auto-claims pending messages whose idle time exceeds minIdleTimeMs.
   *
   * @param stream Stream name
   * @param group Consumer group name
   * @param claimingConsumer Current consumer taking over
   * @param minIdleTimeMs Idle threshold (default 60,000ms = 60s)
   * @param batchLimit Maximum messages to reclaim in a single pass
   */
  async autoClaimDeadWorkerMessages<T = Record<string, string>>(
    stream: string,
    group: string,
    claimingConsumer: string,
    minIdleTimeMs: number = 60000,
    batchLimit: number = 20,
  ): Promise<StreamMessage<T>[]> {
    const pending = await this.xpending(stream, group, '-', '+', batchLimit);
    const expiredIds = pending
      .filter(
        (item) =>
          item.idleTimeMs >= minIdleTimeMs && item.consumer !== claimingConsumer,
      )
      .map((item) => item.id);

    if (expiredIds.length === 0) {
      return [];
    }

    this.logger.warn(
      `Detected ${expiredIds.length} abandoned messages in '${stream}' idle >= ${minIdleTimeMs}ms. Auto-claiming to consumer '${claimingConsumer}'.`,
    );

    return this.xclaim<T>(
      stream,
      group,
      claimingConsumer,
      minIdleTimeMs,
      ...expiredIds,
    );
  }

  /**
   * Retrieves lag and consumer health metrics for Prometheus reporting.
   */
  async getStreamMetrics(
    stream: string,
    group: string,
  ): Promise<StreamGroupLagInfo | null> {
    if (!this.client) {
      return null;
    }

    try {
      const groupsInfo = (await (this.client as any).xinfo('GROUPS', stream)) as any[];
      if (!groupsInfo || !Array.isArray(groupsInfo)) {
        return null;
      }

      for (const rawGroup of groupsInfo) {
        // xinfo GROUPS returns array of key-value pairs or object depending on redis version/client
        const groupObj: Record<string, any> = {};
        if (Array.isArray(rawGroup)) {
          for (let i = 0; i < rawGroup.length; i += 2) {
            groupObj[rawGroup[i]] = rawGroup[i + 1];
          }
        } else if (typeof rawGroup === 'object') {
          Object.assign(groupObj, rawGroup);
        }

        if (groupObj.name === group) {
          const pendingCount = Number(groupObj.pending ?? 0);
          const consumersCount = Number(groupObj.consumers ?? 0);
          const lag = Number(groupObj.lag ?? pendingCount);
          const lastDeliveredId = String(groupObj['last-delivered-id'] ?? '0-0');

          return {
            stream,
            group,
            pendingCount,
            consumersCount,
            lastDeliveredId,
            lag,
          };
        }
      }

      return null;
    } catch (err: any) {
      this.logger.warn(`Could not fetch stream metrics for ${stream}/${group}: ${err.message}`);
      return null;
    }
  }

  /**
   * Trims the stream to a maximum length (XTRIM).
   */
  async xtrim(stream: string, maxLen: number = this.defaultMaxLen): Promise<number> {
    if (!this.client) {
      return 0;
    }
    return (await this.client.xtrim(stream, 'MAXLEN', '~', maxLen)) as number;
  }
}

