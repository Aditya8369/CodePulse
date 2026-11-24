export interface KeystrokePacket {
  userId: string;
  battleId: string;
  sequenceNumber: number;
  charsTypedCount: number;
  clientTimestamp: number;
}

/**
 * BattleLockstepValidatorService
 * Validates monotonic packet sequencing and physical human typing speed limits (< 15 chars/sec),
 * flagging anomalous microsecond burst injections and packet replay.
 */
export class BattleLockstepValidatorService {
  private readonly userSessions = new Map<
    string,
    { lastSeq: number; lastTime: number; totalChars: number; windowStart: number }
  >();
  private readonly maxCharsPerSec = 15; // 150 WPM physical ceiling

  validatePacket(
    packet: KeystrokePacket,
    serverNow: number = Date.now()
  ): { valid: boolean; reason?: 'SEQUENCE_REGRESSION' | 'TYPING_SPEED_VIOLATION' | 'TIME_TRAVEL' } {
    const key = `${packet.battleId}:${packet.userId}`;
    let session = this.userSessions.get(key);

    if (!session) {
      session = {
        lastSeq: packet.sequenceNumber,
        lastTime: serverNow,
        totalChars: packet.charsTypedCount,
        windowStart: serverNow
      };
      this.userSessions.set(key, session);
      return { valid: true };
    }

    // 1. Monotonic sequence verification
    if (packet.sequenceNumber <= session.lastSeq) {
      return { valid: false, reason: 'SEQUENCE_REGRESSION' };
    }

    // 2. Client time drift sanity check
    if (packet.clientTimestamp > serverNow + 5000) {
      return { valid: false, reason: 'TIME_TRAVEL' };
    }

    // 3. Physical human typing speed check (sliding 1s window)
    const elapsedSeconds = Math.max(0.1, (serverNow - session.windowStart) / 1000);
    session.totalChars += packet.charsTypedCount;

    if (session.totalChars / elapsedSeconds > this.maxCharsPerSec && packet.charsTypedCount > 5) {
      return { valid: false, reason: 'TYPING_SPEED_VIOLATION' };
    }

    if (serverNow - session.windowStart > 1000) {
      session.windowStart = serverNow;
      session.totalChars = 0;
    }

    session.lastSeq = packet.sequenceNumber;
    session.lastTime = serverNow;
    return { valid: true };
  }
}
