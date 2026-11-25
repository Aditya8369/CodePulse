/**
 * Architecture Service 92: gRPC Bidirectional Streaming Channel Multiplexer
 * Subsystem: Flow Control
 */

export class GrpcChannelMultiplexerService {
  private activeStreams = new Map<string, number>(); // channelId -> pendingFrames
  private readonly maxWindowFrames: number;

  constructor(maxWindowFrames = 50) {
    this.maxWindowFrames = maxWindowFrames;
  }

  public registerChannel(channelId: string): void {
    this.activeStreams.set(channelId, 0);
  }

  public sendFrame(channelId: string): boolean {
    const pending = this.activeStreams.get(channelId);
    if (pending === undefined || pending >= this.maxWindowFrames) {
      return false; // flow control saturated
    }
    this.activeStreams.set(channelId, pending + 1);
    return true;
  }

  public acknowledgeFrame(channelId: string): void {
    const pending = this.activeStreams.get(channelId);
    if (pending && pending > 0) {
      this.activeStreams.set(channelId, pending - 1);
    }
  }

  public getPendingFrames(channelId: string): number {
    return this.activeStreams.get(channelId) || 0;
  }
}
