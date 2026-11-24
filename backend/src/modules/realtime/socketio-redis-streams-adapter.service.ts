export interface StreamMessage {
  id: number;
  channel: string;
  payload: any;
}

export class SocketioRedisStreamsAdapterService {
  private buffer: StreamMessage[] = [];

  public publish(channel: string, payload: any): StreamMessage {
    const msg: StreamMessage = {
      id: this.buffer.length + 1,
      channel,
      payload
    };
    this.buffer.push(msg);
    return msg;
  }

  public getMissedMessages(channel: string, lastSeenId: number): StreamMessage[] {
    return this.buffer.filter(m => m.channel === channel && m.id > lastSeenId);
  }
}
