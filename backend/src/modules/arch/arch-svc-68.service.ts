/**
 * Architecture Service 68: In-Memory Circular Log Ring Buffer
 * Subsystem: Diagnostic Crash Reporting
 */

export class CircularLogRingBufferService {
  private buffer: string[];
  private capacity: number;
  private head = 0;
  private count = 0;

  constructor(capacity = 100) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  public append(logLine: string): void {
    this.buffer[this.head] = logLine;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  public dumpDiagnosticLogs(): string[] {
    const logs: string[] = [];
    const startIndex = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const idx = (startIndex + i) % this.capacity;
      logs.push(this.buffer[idx]);
    }
    return logs;
  }
}
