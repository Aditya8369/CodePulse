/**
 * Architecture Service 27: Event Storm Absorber
 * Subsystem: Exponential Load-Shedding and Priority Queues
 */

export type EventPriority = 'CRITICAL' | 'NORMAL' | 'BULK';

export interface StormEvent {
  id: string;
  priority: EventPriority;
  payload: unknown;
  timestamp: number;
}

export class EventStormAbsorberService {
  private criticalQueue: StormEvent[] = [];
  private normalQueue: StormEvent[] = [];
  private bulkQueue: StormEvent[] = [];

  private readonly queueLimit: number;
  private readonly stormThreshold: number;

  constructor(
    queueLimit = 100,
    stormThreshold = 80
  ) {
    this.queueLimit = queueLimit;
    this.stormThreshold = stormThreshold;
  }

  public submitEvent(event: StormEvent): { accepted: boolean; queue: EventPriority; shedReason?: string } {
    const totalDepth = this.totalDepth;

    if (totalDepth >= this.queueLimit && event.priority !== 'CRITICAL') {
      return { accepted: false, queue: event.priority, shedReason: 'QUEUE_SATURATED' };
    }

    if (totalDepth >= this.stormThreshold && event.priority === 'BULK') {
      return { accepted: false, queue: 'BULK', shedReason: 'STORM_LOAD_SHED' };
    }

    if (event.priority === 'CRITICAL') {
      this.criticalQueue.push(event);
    } else if (event.priority === 'NORMAL') {
      this.normalQueue.push(event);
    } else {
      this.bulkQueue.push(event);
    }

    return { accepted: true, queue: event.priority };
  }

  public drainNext(): StormEvent | undefined {
    return this.criticalQueue.shift() || this.normalQueue.shift() || this.bulkQueue.shift();
  }

  public get totalDepth(): number {
    return this.criticalQueue.length + this.normalQueue.length + this.bulkQueue.length;
  }
}
