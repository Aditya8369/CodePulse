export interface SdpMessage {
  sessionId: string;
  senderId: string;
  targetId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  timestamp: number;
}

export interface IceCandidateData {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

/**
 * WebRtcSignalingGatewayService
 * Manages SDP offer/answer exchanges, caches trickle ICE candidates,
 * and activates automated TURN relay fallback if P2P fails to connect within 5000ms.
 */
export class WebRtcSignalingGatewayService {
  private readonly sessionCandidates = new Map<string, IceCandidateData[]>();
  private readonly sessionTimers = new Map<string, number>();

  startSession(sessionId: string, now: number = Date.now()): void {
    this.sessionCandidates.set(sessionId, []);
    this.sessionTimers.set(sessionId, now);
  }

  addIceCandidate(sessionId: string, candidate: IceCandidateData): void {
    if (!this.sessionCandidates.has(sessionId)) {
      this.sessionCandidates.set(sessionId, []);
    }
    this.sessionCandidates.get(sessionId)!.push(candidate);
  }

  getCandidates(sessionId: string): IceCandidateData[] {
    return this.sessionCandidates.get(sessionId) || [];
  }

  checkTurnFallback(sessionId: string, now: number = Date.now(), timeoutMs = 5000): {
    requiresTurnFallback: boolean;
    reason?: string;
  } {
    const started = this.sessionTimers.get(sessionId);
    if (!started) return { requiresTurnFallback: false };

    if (now - started > timeoutMs) {
      return {
        requiresTurnFallback: true,
        reason: 'P2P ICE negotiation timed out after 5000ms. Activating Coturn relay server.'
      };
    }
    return { requiresTurnFallback: false };
  }

  closeSession(sessionId: string): void {
    this.sessionCandidates.delete(sessionId);
    this.sessionTimers.delete(sessionId);
  }
}
