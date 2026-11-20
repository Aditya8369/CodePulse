import { Injectable, Logger } from '@nestjs/common';

export interface BattleRoomState {
  battleId: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
  currentRound: number;
  totalRounds: number;
  challengerId: string;
  opponentId: string;
  scores: Record<string, number>;
  roundStartedAt: number;
  expiresAt: number;
}

@Injectable()
export class BattleStateStore {
  private readonly logger = new Logger(BattleStateStore.name);

  // In-memory Redis Hash mirror
  private static roomHashes = new Map<string, BattleRoomState>();

  async setRoomState(battleId: string, state: BattleRoomState): Promise<void> {
    const key = `battle:room:${battleId}`;
    BattleStateStore.roomHashes.set(key, {
      ...state,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2-hour TTL
    });
    this.logger.log(`[Redis State Store] Saved battle state for room #${battleId}`);
  }

  async getRoomState(battleId: string): Promise<BattleRoomState | null> {
    const key = `battle:room:${battleId}`;
    const state = BattleStateStore.roomHashes.get(key);
    if (!state) return null;

    if (state.expiresAt < Date.now()) {
      BattleStateStore.roomHashes.delete(key);
      return null;
    }

    return state;
  }

  async updatePlayerScore(battleId: string, playerId: string, pointsEarned: number): Promise<void> {
    const state = await this.getRoomState(battleId);
    if (!state) return;

    state.scores[playerId] = (state.scores[playerId] || 0) + pointsEarned;
    await this.setRoomState(battleId, state);
  }

  async removeRoom(battleId: string): Promise<void> {
    const key = `battle:room:${battleId}`;
    BattleStateStore.roomHashes.delete(key);
    this.logger.log(`[Redis State Store] Expired battle room #${battleId}`);
  }
}
