import { Injectable } from '@nestjs/common';

export interface JitterPacket {
  sequenceNumber: number;
  timestamp: number;
  payload: string;
}

@Injectable()
export class JitterBufferConcealmentEngineService {
  private readonly packetQueue: JitterPacket[] = [];
  private expectedSequence: number = 0;
  private playoutDelayMs: number = 40;
  private lastPlayoutTimestamp: number = 0;

  public pushPacket(packet: JitterPacket): void {
    this.packetQueue.push(packet);
    this.packetQueue.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  public pullNextPlayout(now: number): { packet: JitterPacket; concealed: boolean } {
    if (this.packetQueue.length === 0) {
      return {
        packet: {
          sequenceNumber: this.expectedSequence++,
          timestamp: now,
          payload: '[CONCEALED_INTERPOLATED_FRAME]',
        },
        concealed: true,
      };
    }

    const next = this.packetQueue[0];
    if (next.sequenceNumber === this.expectedSequence) {
      this.packetQueue.shift();
      this.expectedSequence++;
      this.lastPlayoutTimestamp = now;
      return { packet: next, concealed: false };
    }

    // Underrun gap detected, conceal missing packet
    return {
      packet: {
        sequenceNumber: this.expectedSequence++,
        timestamp: now,
        payload: '[CONCEALED_INTERPOLATED_FRAME]',
      },
      concealed: true,
    };
  }

  public getPlayoutDelayMs(): number {
    return this.playoutDelayMs;
  }
}
