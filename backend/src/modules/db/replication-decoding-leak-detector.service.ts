import { Injectable } from '@nestjs/common';

@Injectable()
export class ReplicationDecodingLeakDetectorService {
  private inFlightWalPacketsCount = 0;
  private readonly maxPacketLeakThreshold = 10000;

  public onWalChunkReceived(): boolean {
    this.inFlightWalPacketsCount++;
    return this.inFlightWalPacketsCount > this.maxPacketLeakThreshold;
  }

  public onWalChunkAcknowledged(): void {
    this.inFlightWalPacketsCount = Math.max(0, this.inFlightWalPacketsCount - 1);
  }

  public getInFlightCount(): number {
    return this.inFlightWalPacketsCount;
  }
}
