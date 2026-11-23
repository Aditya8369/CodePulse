import { Injectable, Logger } from '@nestjs/common';

export interface AuditEventRecord<T = any> {
  eventId: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  sequenceNumber: number;
  timestampMs: number;
}

export interface ReconstructedBattleState {
  battleId: string;
  status: 'INITIALIZING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
  players: Record<
    string,
    {
      userId: string;
      username: string;
      isReady: boolean;
      keystrokeCount: number;
      testCasesPassed: number;
      score: number;
    }
  >;
  currentRound: number;
  winnerUserId: string | null;
  startedAt: number | null;
  endedAt: number | null;
  lastEventSequence: number;
}

export type EventHandler = (event: AuditEventRecord) => void | Promise<void>;

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  // Aggregate event streams: Map<aggregateId, AuditEventRecord[]>
  private readonly events = new Map<string, AuditEventRecord[]>();

  // Event handlers / projection subscribers
  private readonly subscribers = new Map<string, EventHandler[]>();
  private readonly globalSubscribers: EventHandler[] = [];

  /**
   * Appends an immutable domain event to the append-only stream.
   * Dispatches asynchronously to registered projections.
   */
  public appendEvent<T = any>(
    aggregateId: string,
    eventType: string,
    payload: T,
  ): AuditEventRecord<T> {
    const list = this.events.get(aggregateId) || [];
    const sequenceNumber = list.length + 1;

    const record: AuditEventRecord<T> = {
      eventId: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      aggregateId,
      eventType,
      payload,
      sequenceNumber,
      timestampMs: Date.now(),
    };

    list.push(record);
    this.events.set(aggregateId, list);

    // Asynchronously dispatch to subscribers/projections
    this.dispatchToSubscribers(record);

    return record;
  }

  /**
   * Subscribes a projection worker to a specific event type.
   */
  public subscribe(eventType: string, handler: EventHandler): void {
    const list = this.subscribers.get(eventType) || [];
    list.push(handler);
    this.subscribers.set(eventType, list);
  }

  /**
   * Subscribes a projection worker to all domain events.
   */
  public subscribeAll(handler: EventHandler): void {
    this.globalSubscribers.push(handler);
  }

  /**
   * Retrieves all events for an aggregate in deterministic sequence order.
   */
  public getEvents(aggregateId: string): AuditEventRecord[] {
    return this.events.get(aggregateId) || [];
  }

  /**
   * Retrieves events up to a specific timestamp (Time-Travel / Point-in-time recovery).
   */
  public getEventsUntil(aggregateId: string, targetTimestampMs: number): AuditEventRecord[] {
    const list = this.events.get(aggregateId) || [];
    return list.filter((e) => e.timestampMs <= targetTimestampMs);
  }

  /**
   * Frame-by-frame State Reconstruction via Event Replay.
   * Rebuilds authoritative battle state by folding historical events up to target sequence.
   */
  public replayBattleState(
    battleId: string,
    upToSequence?: number,
  ): ReconstructedBattleState {
    const allEvents = this.getEvents(battleId);
    const targetEvents =
      upToSequence !== undefined
        ? allEvents.filter((e) => e.sequenceNumber <= upToSequence)
        : allEvents;

    const state: ReconstructedBattleState = {
      battleId,
      status: 'INITIALIZING',
      players: {},
      currentRound: 1,
      winnerUserId: null,
      startedAt: null,
      endedAt: null,
      lastEventSequence: 0,
    };

    for (const event of targetEvents) {
      state.lastEventSequence = event.sequenceNumber;

      switch (event.eventType) {
        case 'BattleCreated': {
          state.status = 'INITIALIZING';
          state.startedAt = event.timestampMs;
          break;
        }

        case 'PlayerJoined': {
          const { userId, username } = event.payload;
          if (!state.players[userId]) {
            state.players[userId] = {
              userId,
              username: username || userId,
              isReady: false,
              keystrokeCount: 0,
              testCasesPassed: 0,
              score: 0,
            };
          }
          break;
        }

        case 'PlayerReady': {
          const { userId } = event.payload;
          if (state.players[userId]) {
            state.players[userId].isReady = true;
          }
          const allReady =
            Object.keys(state.players).length >= 2 &&
            Object.values(state.players).every((p) => p.isReady);
          if (allReady) {
            state.status = 'IN_PROGRESS';
          }
          break;
        }

        case 'KeystrokeBatchRecorded': {
          const { userId, count } = event.payload;
          if (state.players[userId]) {
            state.players[userId].keystrokeCount += count || 1;
          }
          break;
        }

        case 'TestCaseEvaluated': {
          const { userId, passed, score } = event.payload;
          if (state.players[userId]) {
            if (passed) {
              state.players[userId].testCasesPassed += 1;
            }
            if (score) {
              state.players[userId].score += score;
            }
          }
          break;
        }

        case 'RoundCompleted': {
          state.currentRound = (event.payload.round || state.currentRound) + 1;
          break;
        }

        case 'MatchEnded': {
          state.status = 'COMPLETED';
          state.winnerUserId = event.payload.winnerUserId || null;
          state.endedAt = event.timestampMs;
          break;
        }

        case 'BattleAborted': {
          state.status = 'ABORTED';
          state.endedAt = event.timestampMs;
          break;
        }
      }
    }

    return state;
  }

  /**
   * Dispatches event to registered handlers.
   */
  private dispatchToSubscribers(event: AuditEventRecord): void {
    const handlers = this.subscribers.get(event.eventType) || [];
    for (const handler of handlers) {
      try {
        void handler(event);
      } catch (err) {
        this.logger.error(`Error in event handler for ${event.eventType}: ${err}`);
      }
    }

    for (const globalHandler of this.globalSubscribers) {
      try {
        void globalHandler(event);
      } catch (err) {
        this.logger.error(`Error in global event handler: ${err}`);
      }
    }
  }

  /**
   * Resets internal event stores (useful in test lifecycle).
   */
  public clear(): void {
    this.events.clear();
    this.subscribers.clear();
    this.globalSubscribers.length = 0;
  }
}
