export interface Keyframe {
  timestamp: number;
  state: Record<string, any>;
}

export class MatchTimeTravelReplayService {
  private keyframes: Keyframe[] = [];

  public addKeyframe(timestamp: number, state: Record<string, any>): void {
    this.keyframes.push({ timestamp, state });
  }

  public scrubTo(targetTimestamp: number): Record<string, any> | null {
    let best: Keyframe | null = null;
    for (const kf of this.keyframes) {
      if (kf.timestamp <= targetTimestamp) {
        best = kf;
      }
    }
    return best ? best.state : null;
  }
}
