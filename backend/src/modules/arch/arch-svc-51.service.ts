/**
 * Architecture Service 51: Asynchronous Event Bus Backoff Regulator
 * Subsystem: Reactive Stream Subscriber Throttling
 */

export interface EventBusSubscriber<T = unknown> {
  id: string;
  demand: number; // reactive stream requested demand tokens
  backoffDelayMs: number;
  lastDispatch: number;
}

export class EventBusBackoffRegulatorService {
  private subscribers = new Map<string, EventBusSubscriber>();
  private readonly maxBackoffMs: number;
  private readonly baseBackoffMs: number;

  constructor(baseBackoffMs = 50, maxBackoffMs = 5000) {
    this.baseBackoffMs = baseBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
  }

  public registerSubscriber(id: string, initialDemand = 10): EventBusSubscriber {
    const sub: EventBusSubscriber = {
      id,
      demand: initialDemand,
      backoffDelayMs: 0,
      lastDispatch: 0,
    };
    this.subscribers.set(id, sub);
    return { ...sub };
  }

  public requestDemand(id: string, count: number): void {
    const sub = this.subscribers.get(id);
    if (!sub) return;
    sub.demand += count;
    // Lower backoff on healthy consumption
    sub.backoffDelayMs = Math.max(0, sub.backoffDelayMs - this.baseBackoffMs);
  }

  public signalCongestion(id: string): number {
    const sub = this.subscribers.get(id);
    if (!sub) return 0;
    sub.demand = Math.max(0, Math.floor(sub.demand / 2));
    sub.backoffDelayMs = sub.backoffDelayMs === 0 ? this.baseBackoffMs : Math.min(this.maxBackoffMs, sub.backoffDelayMs * 2);
    return sub.backoffDelayMs;
  }

  public canDispatch(id: string, now = Date.now()): boolean {
    const sub = this.subscribers.get(id);
    if (!sub || sub.demand <= 0) return false;
    return now - sub.lastDispatch >= sub.backoffDelayMs;
  }

  public recordDispatch(id: string, now = Date.now()): boolean {
    const sub = this.subscribers.get(id);
    if (!sub || sub.demand <= 0) return false;
    sub.demand--;
    sub.lastDispatch = now;
    return true;
  }

  public getSubscriber(id: string): EventBusSubscriber | undefined {
    const sub = this.subscribers.get(id);
    return sub ? { ...sub } : undefined;
  }
}
