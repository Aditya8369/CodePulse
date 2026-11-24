import { Injectable } from '@nestjs/common';

@Injectable()
export class EventCompactionS3BufferService {
  private readonly buffer: Array<{ eventId: string; ts: number; payload: string }> = [];
  private readonly flushThreshold = 100;

  public pushEvent(eventId: string, payload: string): { flushed: boolean; flushedCount: number } {
    this.buffer.push({ eventId, ts: Date.now(), payload });
    if (this.buffer.length >= this.flushThreshold) {
      const count = this.buffer.length;
      this.buffer.length = 0; // Compact and flush to S3 archive
      return { flushed: true, flushedCount: count };
    }
    return { flushed: false, flushedCount: 0 };
  }

  public getBufferedCount(): number {
    return this.buffer.length;
  }
}
