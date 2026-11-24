import { Injectable } from '@nestjs/common';

@Injectable()
export class SctpCongestionTunerService {
  private cwndBytes: number = 65536;
  private ssthreshBytes: number = 262144;
  private readonly maxCwndBytes: number = 1048576;
  private readonly minCwndBytes: number = 16384;

  public onAck(bytesAcked: number): number {
    if (this.cwndBytes < this.ssthreshBytes) {
      // Slow start phase: increase exponentially
      this.cwndBytes = Math.min(this.maxCwndBytes, this.cwndBytes + bytesAcked);
    } else {
      // Congestion avoidance phase: additive increase
      this.cwndBytes = Math.min(this.maxCwndBytes, this.cwndBytes + Math.floor((bytesAcked * bytesAcked) / this.cwndBytes));
    }
    return this.cwndBytes;
  }

  public onPacketLoss(): number {
    // Multiplicative decrease
    this.ssthreshBytes = Math.max(this.minCwndBytes, Math.floor(this.cwndBytes / 2));
    this.cwndBytes = this.ssthreshBytes;
    return this.cwndBytes;
  }

  public getCwnd(): number {
    return this.cwndBytes;
  }
}
