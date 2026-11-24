import { Injectable } from '@nestjs/common';

export interface FramePacket {
  frameId: number;
  isKeyframe: boolean;
  priority: 'CRITICAL' | 'NORMAL' | 'LOW';
  data: string;
}

@Injectable()
export class AdaptiveFrameDropperService {
  private readonly clientLagMetrics = new Map<string, number>();

  public updateClientRtt(clientId: string, rttMs: number): void {
    this.clientLagMetrics.set(clientId, rttMs);
  }

  public shouldDropFrame(clientId: string, frame: FramePacket): boolean {
    // Keyframes and critical state packets are never dropped
    if (frame.isKeyframe || frame.priority === 'CRITICAL') {
      return false;
    }

    const rtt = this.clientLagMetrics.get(clientId) || 50;

    // High cellular latency (> 300ms): Drop LOW and NORMAL frames
    if (rtt > 300) {
      return true;
    }

    // Moderate cellular latency (> 150ms): Drop LOW priority frames only
    if (rtt > 150 && frame.priority === 'LOW') {
      return true;
    }

    return false;
  }
}
