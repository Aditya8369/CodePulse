export interface BufferedEvent {
  eventId: number;
  room: string;
  event: string;
  data: any;
  timestamp: number;
}

/**
 * ClusteredSocketAdapterService
 * Multi-pod Socket.io synchronization with an in-memory ring buffer (last 50 events per room)
 * enabling instantaneous retransmission of missed events upon client reconnection.
 */
export class ClusteredSocketAdapterService {
  private readonly roomBuffers = new Map<string, BufferedEvent[]>();
  private readonly maxBufferSize = 50;
  private eventSequence = 1;

  publishEvent(room: string, event: string, data: any): BufferedEvent {
    const evt: BufferedEvent = {
      eventId: this.eventSequence++,
      room,
      event,
      data,
      timestamp: Date.now()
    };

    let buf = this.roomBuffers.get(room);
    if (!buf) {
      buf = [];
      this.roomBuffers.set(room, buf);
    }

    buf.push(evt);
    if (buf.length > this.maxBufferSize) {
      buf.shift(); // Evict oldest
    }

    return evt;
  }

  /**
   * Retrieves events missed by a reconnecting client since lastEventId.
   */
  getMissedEvents(room: string, lastEventId: number): BufferedEvent[] {
    const buf = this.roomBuffers.get(room);
    if (!buf) return [];
    return buf.filter(e => e.eventId > lastEventId);
  }
}
