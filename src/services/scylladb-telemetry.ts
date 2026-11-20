/**
 * ScyllaDB / Cassandra Telemetry Client Service
 * High-throughput client for buffering, batch-sending keystroke telemetry,
 * and streaming ordered timelines for match replays.
 */

export interface KeystrokeTelemetryEvent {
  battleId: string;
  bucketHour?: string | Date;
  timestamp: string | Date;
  eventId?: string;
  playerId: string;
  cursorX?: number;
  cursorY?: number;
  cursorOffset?: number;
  charDelta: string;
  actionType?: 'KEY_PRESS' | 'CURSOR_MOVE' | 'PASTE' | 'DELETE' | 'EXECUTE' | 'COMPILATION';
  wpm?: number;
  latencyMs?: number;
  metadata?: Record<string, string>;
}

export interface TelemetryBenchmarkResult {
  totalEventsIngested: number;
  totalDurationMs: number;
  throughputEventsPerSecond: number;
  avgWriteAckLatencyMs: number;
  sub5msAckMet: boolean;
  throughputTargetMet: boolean;
}

export interface ScyllaEngineStats {
  keyspace: string;
  table: string;
  totalEventsIngested: number;
  totalUnloggedBatchesFlushed: number;
  totalQueriesExecuted: number;
  bufferedEventsCount: number;
  driverConnected: boolean;
  usingFallback: boolean;
  compactionStrategy: string;
  retentionTtlSeconds: number;
  tokenAwareRoutingEnabled: boolean;
}

export class ScyllaDbTelemetryClient {
  private static instance: ScyllaDbTelemetryClient | null = null;
  private readonly baseUrl: string;
  private localBuffer: KeystrokeTelemetryEvent[] = [];
  private fallbackStore: Map<string, KeystrokeTelemetryEvent[]> = new Map();
  private isOnline = true;

  public constructor(baseUrl: string = '/api/v1/analytics/telemetry') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public static getInstance(baseUrl?: string): ScyllaDbTelemetryClient {
    if (!ScyllaDbTelemetryClient.instance) {
      ScyllaDbTelemetryClient.instance = new ScyllaDbTelemetryClient(baseUrl);
    }
    return ScyllaDbTelemetryClient.instance;
  }

  public static resetInstance(): void {
    ScyllaDbTelemetryClient.instance = null;
  }

  public setDriverOnline(online: boolean): void {
    this.isOnline = online;
  }

  /**
   * Buffers single keystroke event locally
   */
  public queueKeystroke(event: KeystrokeTelemetryEvent): void {
    const enriched = {
      ...event,
      timestamp: event.timestamp || new Date(),
      eventId: event.eventId || `evt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    };
    this.localBuffer.push(enriched);
  }

  /**
   * Flushes local buffer to backend ScyllaDB batch endpoint with driver failover
   */
  public async flushBatch(): Promise<{ ingestedCount: number; ack: boolean; failover: boolean }> {
    if (this.localBuffer.length === 0) {
      return { ingestedCount: 0, ack: true, failover: false };
    }

    const payload = [...this.localBuffer];
    this.localBuffer = [];

    // If driver failover is active (offline cluster), buffer into memory store
    if (!this.isOnline) {
      for (const item of payload) {
        const list = this.fallbackStore.get(item.battleId) || [];
        list.push(item);
        this.fallbackStore.set(item.battleId, list);
      }
      return { ingestedCount: payload.length, ack: true, failover: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/keystrokes/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Batch ingestion failed: HTTP ${res.status}`);
      }

      const data = await res.json();
      return { ingestedCount: data.ingestedCount, ack: data.ack, failover: false };
    } catch {
      // Driver failover recovery: retain in fallback memory store
      for (const item of payload) {
        const list = this.fallbackStore.get(item.battleId) || [];
        list.push(item);
        this.fallbackStore.set(item.battleId, list);
      }
      return { ingestedCount: payload.length, ack: true, failover: true };
    }
  }

  /**
   * Retrieves ordered time-series keystroke timeline for battle replay
   */
  public async getBattleTimeline(
    battleId: string,
    limit?: number,
  ): Promise<KeystrokeTelemetryEvent[]> {
    if (!this.isOnline || this.fallbackStore.has(battleId)) {
      const fallbackList = this.fallbackStore.get(battleId) || [];
      const sorted = [...fallbackList].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      return limit ? sorted.slice(0, limit) : sorted;
    }

    let url = `${this.baseUrl}/keystrokes/${encodeURIComponent(battleId)}`;
    if (limit) {
      url += `?limit=${limit}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch timeline: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getStats(): Promise<ScyllaEngineStats> {
    const res = await fetch(`${this.baseUrl}/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch telemetry stats: HTTP ${res.status}`);
    }
    return res.json();
  }

  public getBufferSize(): number {
    return this.localBuffer.length;
  }

  public clear(): void {
    this.localBuffer = [];
    this.fallbackStore.clear();
  }
}

