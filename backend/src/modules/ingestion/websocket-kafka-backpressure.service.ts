export type PressureState = 'NORMAL' | 'DEGRADED' | 'PAUSED';

export interface IngestionFrame {
  type: 'critical' | 'telemetry';
  data: any;
}

export class WebSocketKafkaBackpressureService {
  private lowWatermark: number;
  private highWatermark: number;
  private currentBufferLength: number = 0;
  private state: PressureState = 'NORMAL';

  constructor(lowWatermark: number = 2000, highWatermark: number = 5000) {
    this.lowWatermark = lowWatermark;
    this.highWatermark = highWatermark;
  }

  public updateQueueDepth(depth: number): PressureState {
    this.currentBufferLength = depth;

    if (depth >= this.highWatermark) {
      this.state = 'PAUSED';
    } else if (depth >= this.lowWatermark) {
      this.state = 'DEGRADED';
    } else {
      this.state = 'NORMAL';
    }

    return this.state;
  }

  public shouldAcceptFrame(frame: IngestionFrame): boolean {
    if (this.state === 'NORMAL') return true;

    if (this.state === 'DEGRADED') {
      // In degraded mode, shed non-critical telemetry frames (e.g. mouse move, hover)
      return frame.type === 'critical';
    }

    // In paused mode, shed all incoming frames
    return false;
  }

  public getState(): PressureState {
    return this.state;
  }
}
