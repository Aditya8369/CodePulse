export interface LogRecord {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  msg: string;
  context?: Record<string, any>;
  timestamp: string;
}

export class ZeroAllocationLoggerService {
  private ringBuffer: string[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;
  private isDraining = false;

  constructor(capacity = 50000) {
    this.capacity = capacity;
    this.ringBuffer = new Array<string>(this.capacity);
  }

  public log(level: LogRecord['level'], msg: string, context?: Record<string, any>): void {
    const payload = JSON.stringify({
      level,
      msg,
      ...(context ? { context } : {}),
      ts: new Date().toISOString()
    });

    this.ringBuffer[this.tail] = payload;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Overwrite oldest entry
      this.head = (this.head + 1) % this.capacity;
    }
  }

  public drain(): string[] {
    const items: string[] = [];
    while (this.count > 0) {
      items.push(this.ringBuffer[this.head]);
      this.head = (this.head + 1) % this.capacity;
      this.count--;
    }
    return items;
  }

  public getBufferedCount(): number {
    return this.count;
  }
}
