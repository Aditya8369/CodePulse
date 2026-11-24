import { Injectable, Logger } from '@nestjs/common';

export interface CommitEvent {
  sequence: number;
  payload: unknown;
}

@Injectable()
export class OutOfOrderEventReconcilerService {
  private readonly logger = new Logger(OutOfOrderEventReconcilerService.name);
  private nextExpectedSeq = new Map<string, number>();
  private buffer = new Map<string, Map<number, unknown>>();

  public ingest(streamId: string, sequence: number, payload: unknown): { committed: CommitEvent[]; pendingCount: number } {
    let expected = this.nextExpectedSeq.get(streamId) ?? 1;
    let streamBuf = this.buffer.get(streamId);
    if (!streamBuf) {
      streamBuf = new Map<number, unknown>();
      this.buffer.set(streamId, streamBuf);
    }

    streamBuf.set(sequence, payload);
    const committed: CommitEvent[] = [];

    while (streamBuf.has(expected)) {
      const p = streamBuf.get(expected);
      streamBuf.delete(expected);
      committed.push({ sequence: expected, payload: p });
      expected++;
    }

    this.nextExpectedSeq.set(streamId, expected);
    return { committed, pendingCount: streamBuf.size };
  }
}
