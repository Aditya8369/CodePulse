/**
 * Architecture Service 87: Realtime Event Ordering Coordinator
 * Subsystem: Lamport Logical Timestamps
 */

export class LamportLogicalTimestampService {
  private clock = 0;

  public tickLocal(): number {
    this.clock++;
    return this.clock;
  }

  public updateOnReceive(receivedTimestamp: number): number {
    this.clock = Math.max(this.clock, receivedTimestamp) + 1;
    return this.clock;
  }

  public get currentClock(): number {
    return this.clock;
  }
}
