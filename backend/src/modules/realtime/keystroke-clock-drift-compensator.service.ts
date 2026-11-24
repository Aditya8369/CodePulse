import { Injectable } from '@nestjs/common';

export interface ClockSyncPacket {
  clientSendTime: number;
  serverReceiveTime: number;
  serverReplyTime: number;
  clientReceiveTime: number;
}

export interface KeystrokeEvent {
  keyId: string;
  clientTimestamp: number;
  correctedTimestamp?: number;
  keystroke: string;
}

@Injectable()
export class KeystrokeClockDriftCompensatorService {
  private readonly clientDriftOffsets = new Map<string, number>();
  private readonly rttHistories = new Map<string, number[]>();

  public processClockSync(clientId: string, packet: ClockSyncPacket): { offsetMs: number; rttMs: number } {
    // Cristian's / NTP offset estimation
    const roundTripTime = (packet.clientReceiveTime - packet.clientSendTime) - (packet.serverReplyTime - packet.serverReceiveTime);
    const clockOffset = ((packet.serverReceiveTime - packet.clientSendTime) + (packet.serverReplyTime - packet.clientReceiveTime)) / 2;

    const rttHistory = this.rttHistories.get(clientId) || [];
    rttHistory.push(roundTripTime);
    if (rttHistory.length > 10) rttHistory.shift();
    this.rttHistories.set(clientId, rttHistory);

    // Apply exponential smoothing to prevent clock jitter jumps
    const existingOffset = this.clientDriftOffsets.get(clientId) ?? clockOffset;
    const smoothedOffset = (existingOffset * 0.7) + (clockOffset * 0.3);
    this.clientDriftOffsets.set(clientId, smoothedOffset);

    return { offsetMs: smoothedOffset, rttMs: roundTripTime };
  }

  public compensateKeystroke(clientId: string, event: KeystrokeEvent): KeystrokeEvent {
    const offset = this.clientDriftOffsets.get(clientId) || 0;
    return {
      ...event,
      correctedTimestamp: event.clientTimestamp + offset,
    };
  }

  public getOffset(clientId: string): number {
    return this.clientDriftOffsets.get(clientId) || 0;
  }
}
