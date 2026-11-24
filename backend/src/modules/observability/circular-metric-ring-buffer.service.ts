export class CircularMetricRingBufferService<T> {
  private buffer: (T | null)[];
  private capacity: number;
  private head: number = 0;
  private size: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  public push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) this.size++;
  }

  public snapshot(): T[] {
    const result: T[] = [];
    let idx = (this.head - this.size + this.capacity) % this.capacity;
    for (let i = 0; i < this.size; i++) {
      if (this.buffer[idx] !== null) {
        result.push(this.buffer[idx] as T);
      }
      idx = (idx + 1) % this.capacity;
    }
    return result;
  }
}
