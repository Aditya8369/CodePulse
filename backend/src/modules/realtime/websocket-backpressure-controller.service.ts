export class WebSocketBackpressureControllerService {
  private queueLimit = 50;

  public shouldDropFrame(clientQueueSize: number, isCriticalEvent: boolean): boolean {
    if (isCriticalEvent) return false; // Never drop match end or winner events
    return clientQueueSize > this.queueLimit;
  }
}
