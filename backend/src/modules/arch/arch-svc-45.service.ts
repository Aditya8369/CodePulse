/**
 * Architecture Service 45: Event Stream Replay Debugger
 * Subsystem: Past State Timeline Reconstruction
 */

export interface RecordedEvent<T = any> {
  id: string;
  timestamp: number;
  type: string;
  data: T;
}

export class EventStreamReplayDebuggerService {
  private events: RecordedEvent[] = [];

  public recordEvent(event: RecordedEvent): void {
    this.events.push(event);
    this.events.sort((a, b) => a.timestamp - b.timestamp);
  }

  public reconstructStateAt<S>(
    targetTimestamp: number,
    initialState: S,
    reducer: (state: S, event: RecordedEvent) => S
  ): S {
    let state = initialState;
    for (const evt of this.events) {
      if (evt.timestamp <= targetTimestamp) {
        state = reducer(state, evt);
      }
    }
    return state;
  }
}
