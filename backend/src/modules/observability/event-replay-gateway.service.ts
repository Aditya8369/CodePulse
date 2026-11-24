export interface RecordedEvent {
  id: string;
  battleId: string;
  eventType: string;
  timestampMs: number;
  payload: any;
}

export interface ReplayWindow {
  battleId: string;
  startMs: number;
  endMs: number;
}

export class EventReplayGatewayService {
  private eventLog: RecordedEvent[] = [];

  public appendEvent(event: RecordedEvent): void {
    this.eventLog.push(event);
  }

  public extractReplaySlice(window: ReplayWindow): RecordedEvent[] {
    return this.eventLog
      .filter(
        e =>
          e.battleId === window.battleId &&
          e.timestampMs >= window.startMs &&
          e.timestampMs <= window.endMs
      )
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }

  public simulateReplay(slice: RecordedEvent[], sink: (event: RecordedEvent) => void): number {
    let replayed = 0;
    for (const event of slice) {
      sink(event);
      replayed++;
    }
    return replayed;
  }
}
