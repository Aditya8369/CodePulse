export interface KeystrokeEvent {
  userId: string;
  battleId: string;
  key: string;
  timestamp: number;
}

export class KeystrokeRingBufferService {
  private buffer: Array<KeystrokeEvent | null>;
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private droppedCount: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  public push(event: KeystrokeEvent): boolean {
    if (this.size === this.capacity) {
      // Overwrite oldest item at tail
      this.tail = (this.tail + 1) % this.capacity;
      this.droppedCount++;
    } else {
      this.size++;
    }

    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.capacity;
    return true;
  }

  public drainMicroBatch(maxItems: number = 50): KeystrokeEvent[] {
    const batch: KeystrokeEvent[] = [];
    const count = Math.min(maxItems, this.size);

    for (let i = 0; i < count; i++) {
      const item = this.buffer[this.tail];
      if (item) {
        batch.push(item);
        this.buffer[this.tail] = null;
      }
      this.tail = (this.tail + 1) % this.capacity;
      this.size--;
    }

    return batch;
  }

  public getSize(): number {
    return this.size;
  }

  public getDroppedCount(): number {
    return this.droppedCount;
  }
}
