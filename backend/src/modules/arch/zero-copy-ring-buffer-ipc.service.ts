import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ZeroCopyRingBufferIpcService {
  private readonly logger = new Logger(ZeroCopyRingBufferIpcService.name);
  private capacity: number;
  private buffer: any[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(capacity: number = 64) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  public push(item: any): boolean {
    if (this.count === this.capacity) {
      return false; // Buffer full (backpressure signal)
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  public pop(): any | null {
    if (this.count === 0) {
      return null;
    }
    const item = this.buffer[this.head];
    this.buffer[this.head] = null; // Free pointer
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  public getAvailableSlots(): number {
    return this.capacity - this.count;
  }
}
