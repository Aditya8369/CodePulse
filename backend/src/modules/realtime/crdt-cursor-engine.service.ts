import { Injectable } from '@nestjs/common';

export interface CursorState {
  userId: string;
  line: number;
  column: number;
  lamportTimestamp: number;
}

@Injectable()
export class CrdtCursorEngineService {
  private readonly cursors = new Map<string, CursorState>();
  private localLamportClock = 0;

  public updateCursor(userId: string, line: number, column: number, remoteClock: number): CursorState {
    this.localLamportClock = Math.max(this.localLamportClock, remoteClock) + 1;
    const existing = this.cursors.get(userId);

    // Last-Write-Wins based on Lamport clock
    if (!existing || remoteClock >= existing.lamportTimestamp) {
      const state: CursorState = {
        userId,
        line,
        column,
        lamportTimestamp: this.localLamportClock,
      };
      this.cursors.set(userId, state);
      return state;
    }

    return existing;
  }

  public getAllCursors(): CursorState[] {
    return Array.from(this.cursors.values());
  }
}
