export interface BattleStateSnapshot {
  battleId: string;
  userId: string;
  code: string;
  cursorPosition: { line: number; column: number };
  elapsedSeconds: number;
  reconnectToken: string;
  timestamp: number;
}

/**
 * ZeroLossHandoffCoordinatorService
 * Enables seamless WebSocket pod handoff during rolling deployments without dropping battle state.
 */
export class ZeroLossHandoffCoordinatorService {
  private readonly snapshots = new Map<string, BattleStateSnapshot>();
  private readonly tokenToBattle = new Map<string, string>();
  private readonly snapshotTtlMs = 60000; // 60s reconnection grace window

  saveSnapshot(snapshot: BattleStateSnapshot): void {
    const key = `${snapshot.battleId}:${snapshot.userId}`;
    this.snapshots.set(key, snapshot);
    this.tokenToBattle.set(snapshot.reconnectToken, key);
  }

  resumeHandoff(
    reconnectToken: string,
    now: number = Date.now()
  ): { resumed: boolean; snapshot?: BattleStateSnapshot; reason?: string } {
    const key = this.tokenToBattle.get(reconnectToken);
    if (!key) {
      return { resumed: false, reason: 'Invalid or expired reconnection token' };
    }

    const snapshot = this.snapshots.get(key);
    if (!snapshot || now - snapshot.timestamp > this.snapshotTtlMs) {
      this.tokenToBattle.delete(reconnectToken);
      this.snapshots.delete(key);
      return { resumed: false, reason: 'Reconnection window expired (>60s)' };
    }

    return { resumed: true, snapshot };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [token, key] of this.tokenToBattle.entries()) {
      const snap = this.snapshots.get(key);
      if (!snap || now - snap.timestamp > this.snapshotTtlMs) {
        this.tokenToBattle.delete(token);
        this.snapshots.delete(key);
      }
    }
  }
}
