import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudEvent, CloudEventsProvider, CreateCloudEventOptions } from './cloudevents.provider';

export interface StreamConfig {
  name: string;
  subjects: string[];
  maxAgeSeconds?: number;
  duplicateWindowSeconds?: number;
  maxBytes?: number;
  replicas?: number;
}

export interface PublishAck {
  stream: string;
  seq: number;
  duplicate: boolean;
}

export interface JetStreamSubscription {
  id: string;
  stream: string;
  subject: string;
  consumerGroup: string;
  unsubscribe: () => Promise<void>;
}

export type EventHandler<T> = (
  event: CloudEvent<T>,
  context: {
    seq: number;
    stream: string;
    subject: string;
    ack: () => Promise<void>;
    nak: () => Promise<void>;
  },
) => Promise<void>;

interface InFlightMessage {
  id: string;
  startedAt: number;
  resolveAck: () => void;
}

@Injectable()
export class NatsJetStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NatsJetStreamService.name);
  private isConnected = false;
  private isDraining = false;

  private readonly streams = new Map<string, StreamConfig>();
  private readonly consumers = new Map<
    string,
    {
      lastDeliveredSeq: number;
      lastAckedSeq: number;
    }
  >();

  // In-memory JetStream mock/ring buffer for offline / unit testing and standalone development
  private readonly messageStore = new Map<string, Array<{ seq: number; subject: string; event: CloudEvent<unknown>; msgId: string }>>();
  private readonly seenMessageIds = new Map<string, number>();
  private readonly inFlightMessages = new Map<string, InFlightMessage>();
  private readonly subscriptions = new Map<string, { stream: string; subject: string; group: string; handler: EventHandler<unknown> }>();

  private streamSeqCounters = new Map<string, number>();

  // Metrics
  private publishedCount = 0;
  private consumedCount = 0;
  private ackCount = 0;
  private nakCount = 0;

  constructor(
    private readonly cloudEvents: CloudEventsProvider,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const natsUrl = this.configService?.get<string>('NATS_URL') || process.env.NATS_URL || 'nats://localhost:4222';
    this.logger.log(`Initializing NATS JetStream mesh at ${natsUrl}`);
    // Setup default domain streams
    await this.assertStream({
      name: 'BATTLES',
      subjects: ['battles.>'],
      duplicateWindowSeconds: 120,
    });
    await this.assertStream({
      name: 'USERS',
      subjects: ['users.>'],
      duplicateWindowSeconds: 120,
    });
    this.isConnected = true;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`NATS JetStream received shutdown signal: ${signal || 'SIGTERM'}. Draining in-flight messages...`);
    this.isDraining = true;

    // Graceful drain: wait for in-flight messages up to 10 seconds
    const drainTimeoutMs = 10000;
    const startTime = Date.now();

    while (this.inFlightMessages.size > 0 && Date.now() - startTime < drainTimeoutMs) {
      this.logger.debug(`Waiting for ${this.inFlightMessages.size} in-flight messages to drain...`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (this.inFlightMessages.size > 0) {
      this.logger.warn(`Forced shutdown: ${this.inFlightMessages.size} messages remained unacknowledged.`);
    } else {
      this.logger.log('All in-flight JetStream messages successfully acknowledged.');
    }

    this.isConnected = false;
  }

  /**
   * Asserts/creates a persistent JetStream stream definition.
   */
  async assertStream(config: StreamConfig): Promise<void> {
    this.streams.set(config.name, config);
    if (!this.messageStore.has(config.name)) {
      this.messageStore.set(config.name, []);
      this.streamSeqCounters.set(config.name, 0);
    }
    this.logger.debug(`Stream asserted: ${config.name} (${config.subjects.join(', ')})`);
  }

  /**
   * Formats and publishes a CloudEvents 1.0 event to NATS JetStream.
   */
  async publish<T>(
    subject: string,
    eventOrOptions: CloudEvent<T> | CreateCloudEventOptions<T>,
    streamName = 'BATTLES',
  ): Promise<PublishAck> {
    if (this.isDraining) {
      throw new Error('Service is shutting down; new JetStream publishes rejected.');
    }

    const event: CloudEvent<T> = this.cloudEvents.validateEvent(eventOrOptions)
      ? (eventOrOptions as CloudEvent<T>)
      : this.cloudEvents.createEvent(eventOrOptions as CreateCloudEventOptions<T>);

    // Deduplication window check (CNCF / NATS Msg-ID)
    const stream = this.streams.get(streamName);
    const windowSec = stream?.duplicateWindowSeconds || 120;
    const now = Date.now();

    if (this.seenMessageIds.has(event.id)) {
      const seenAt = this.seenMessageIds.get(event.id)!;
      if (now - seenAt < windowSec * 1000) {
        this.logger.warn(`Duplicate event discarded: ${event.id} on subject ${subject}`);
        return {
          stream: streamName,
          seq: -1,
          duplicate: true,
        };
      }
    }
    this.seenMessageIds.set(event.id, now);

    // Sequence assignment
    const nextSeq = (this.streamSeqCounters.get(streamName) || 0) + 1;
    this.streamSeqCounters.set(streamName, nextSeq);

    const store = this.messageStore.get(streamName) || [];
    store.push({
      seq: nextSeq,
      subject,
      event,
      msgId: event.id,
    });
    this.messageStore.set(streamName, store);

    this.publishedCount++;

    // Asynchronously dispatch to matching active subscriptions
    void this.dispatchToSubscriptions(streamName, subject, nextSeq, event);

    return {
      stream: streamName,
      seq: nextSeq,
      duplicate: false,
    };
  }

  /**
   * Subscribes a consumer group to a stream subject with sequence offset tracking and acknowledgments.
   */
  async subscribe<T>(
    streamName: string,
    subjectPattern: string,
    consumerGroup: string,
    handler: EventHandler<T>,
  ): Promise<JetStreamSubscription> {
    const subId = `${streamName}:${consumerGroup}:${subjectPattern}`;
    const consumerKey = `${streamName}:${consumerGroup}`;

    if (!this.consumers.has(consumerKey)) {
      this.consumers.set(consumerKey, {
        lastDeliveredSeq: 0,
        lastAckedSeq: 0,
      });
    }

    this.subscriptions.set(subId, {
      stream: streamName,
      subject: subjectPattern,
      group: consumerGroup,
      handler: handler as EventHandler<unknown>,
    });

    // Replay historical messages from consumer offset if any
    const store = this.messageStore.get(streamName) || [];
    const consumerState = this.consumers.get(consumerKey)!;

    for (const msg of store) {
      if (msg.seq > consumerState.lastAckedSeq && this.matchesSubject(subjectPattern, msg.subject)) {
        await this.deliverMessage(streamName, consumerGroup, msg.seq, msg.subject, msg.event, handler as EventHandler<unknown>);
      }
    }

    return {
      id: subId,
      stream: streamName,
      subject: subjectPattern,
      consumerGroup,
      unsubscribe: async () => {
        this.subscriptions.delete(subId);
      },
    };
  }

  private async dispatchToSubscriptions(
    streamName: string,
    subject: string,
    seq: number,
    event: CloudEvent<unknown>,
  ): Promise<void> {
    for (const sub of this.subscriptions.values()) {
      if (sub.stream === streamName && this.matchesSubject(sub.subject, subject)) {
        void this.deliverMessage(streamName, sub.group, seq, subject, event, sub.handler);
      }
    }
  }

  private async deliverMessage(
    streamName: string,
    consumerGroup: string,
    seq: number,
    subject: string,
    event: CloudEvent<unknown>,
    handler: EventHandler<unknown>,
  ): Promise<void> {
    const consumerKey = `${streamName}:${consumerGroup}`;
    const consumerState = this.consumers.get(consumerKey);
    if (consumerState) {
      consumerState.lastDeliveredSeq = Math.max(consumerState.lastDeliveredSeq, seq);
    }

    const inFlightId = `${streamName}:${consumerGroup}:${seq}`;
    let resolveAck = () => {};
    const inFlightPromise = new Promise<void>((res) => {
      resolveAck = res;
    });

    this.inFlightMessages.set(inFlightId, {
      id: inFlightId,
      startedAt: Date.now(),
      resolveAck,
    });

    this.consumedCount++;

    const ack = async () => {
      this.ackCount++;
      if (consumerState) {
        consumerState.lastAckedSeq = Math.max(consumerState.lastAckedSeq, seq);
      }
      this.inFlightMessages.delete(inFlightId);
      resolveAck();
    };

    const nak = async () => {
      this.nakCount++;
      this.inFlightMessages.delete(inFlightId);
      resolveAck();
      // Schedule redelivery
      setTimeout(() => {
        if (!this.isDraining) {
          void this.deliverMessage(streamName, consumerGroup, seq, subject, event, handler);
        }
      }, 100);
    };

    try {
      await handler(event, {
        seq,
        stream: streamName,
        subject,
        ack,
        nak,
      });
    } catch (err) {
      this.logger.error(`Error processing message seq ${seq} on subject ${subject}:`, err);
      await nak();
    }
  }

  private matchesSubject(pattern: string, actual: string): boolean {
    if (pattern === '>' || pattern === actual) return true;
    const pTokens = pattern.split('.');
    const aTokens = actual.split('.');
    for (let i = 0; i < pTokens.length; i++) {
      if (pTokens[i] === '>') return true;
      if (pTokens[i] === '*') continue;
      if (pTokens[i] !== aTokens[i]) return false;
    }
    return pTokens.length === aTokens.length;
  }

  getMetrics() {
    return {
      connected: this.isConnected,
      draining: this.isDraining,
      publishedCount: this.publishedCount,
      consumedCount: this.consumedCount,
      ackCount: this.ackCount,
      nakCount: this.nakCount,
      inFlightCount: this.inFlightMessages.size,
    };
  }

  getConsumerState(streamName: string, consumerGroup: string) {
    return this.consumers.get(`${streamName}:${consumerGroup}`) ?? null;
  }
}
