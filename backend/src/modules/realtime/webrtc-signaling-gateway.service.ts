export interface SignalPayload {
  roomId: string;
  senderId: string;
  targetId: string;
  sdpOrCandidate: any;
}

export class WebRTCSignalingGatewayService {
  private candidatePool = new Map<string, any[]>();

  public cacheCandidate(roomId: string, candidate: any): void {
    if (!this.candidatePool.has(roomId)) {
      this.candidatePool.set(roomId, []);
    }
    this.candidatePool.get(roomId)!.push(candidate);
  }

  public getCandidates(roomId: string): any[] {
    return this.candidatePool.get(roomId) || [];
  }
}
