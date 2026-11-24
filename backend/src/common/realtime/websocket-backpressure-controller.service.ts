export type FramePriority = 'CRITICAL' | 'NORMAL' | 'LOW';

export interface QueuedSocketFrame {
  id: string;
  priority: FramePriority;
  data: any;
  sizeBytes: number;
}

/**
 * WebSocketBackpressureControllerService
 * Monitors buffer pressure on client connections and adaptively drops non-critical frames (animations, particle diffs)
 * during network congestion while guaranteeing delivery of critical keystrokes and submissions.
 */
export class WebSocketBackpressureControllerService {
  private readonly maxBufferBytes = 64 * 1024; // 64KB backpressure threshold

  shouldDropFrame(currentBufferedBytes: number, priority: FramePriority): boolean {
    if (priority === 'CRITICAL') {
      return false; // Critical frames are never dropped
    }

    if (currentBufferedBytes >= this.maxBufferBytes) {
      return true; // Over threshold: drop normal and low frames
    }

    if (currentBufferedBytes >= this.maxBufferBytes * 0.75 && priority === 'LOW') {
      return true; // At 75% capacity: drop low-priority animation frames
    }

    return false;
  }

  calculateThrottleDelay(currentBufferedBytes: number): number {
    if (currentBufferedBytes < this.maxBufferBytes * 0.5) return 0;
    const ratio = (currentBufferedBytes - this.maxBufferBytes * 0.5) / (this.maxBufferBytes * 0.5);
    return Math.min(200, Math.round(ratio * 100)); // Up to 100ms throttle delay
  }
}
