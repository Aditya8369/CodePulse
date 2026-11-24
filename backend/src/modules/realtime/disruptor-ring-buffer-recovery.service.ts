import { Injectable } from '@nestjs/common';

export interface RingBufferSlot<T> {
  sequence: number;
  data: T | null;
  published: boolean;
}

@Injectable()
export class DisruptorRingBufferRecoveryService<T = any> {
  private readonly bufferSize: number;
  private readonly buffer: RingBufferSlot<T>[];
  private cursor: number = -1;
  private consumerSequence: number = 0;
  private droppedEventsCount: number = 0;

  constructor(size: number = 1024) {
    this.bufferSize = (size & (size - 1)) === 0 ? size : 1024; // Ensure power of 2
    this.buffer = new Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      this.buffer[i] = { sequence: -1, data: null, published: false };
    }
  }

  public publish(data: T): { sequence: number; overrunDetected: boolean } {
    const nextSeq = ++this.cursor;
    const index = nextSeq & (this.bufferSize - 1);

    // Overrun occurs when producer laps consumer sequence by bufferSize
    let overrun = false;
    if (nextSeq - this.consumerSequence >= this.bufferSize) {
      overrun = true;
      this.droppedEventsCount += (nextSeq - this.consumerSequence - this.bufferSize + 1);
      // Fast-forward consumer to prevent permanent deadlock
      this.consumerSequence = nextSeq - this.bufferSize + 1;
    }

    this.buffer[index] = {
      sequence: nextSeq,
      data,
      published: true,
    };

    return { sequence: nextSeq, overrunDetected: overrun };
  }

  public consumeNext(): { sequence: number; data: T | null; available: boolean } {
    if (this.consumerSequence > this.cursor) {
      return { sequence: this.consumerSequence, data: null, available: false };
    }

    const index = this.consumerSequence & (this.bufferSize - 1);
    const slot = this.buffer[index];

    if (!slot || !slot.published || slot.sequence !== this.consumerSequence) {
      return { sequence: this.consumerSequence, data: null, available: false };
    }

    const item = slot.data;
    const seq = slot.sequence;
    this.consumerSequence++;

    return { sequence: seq, data: item, available: true };
  }

  public getDroppedEventsCount(): number {
    return this.droppedEventsCount;
  }

  public getCursor(): number {
    return this.cursor;
  }
}
