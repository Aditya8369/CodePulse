import { Injectable, Logger } from '@nestjs/common';

export interface DisconnectBufferEntry {
  battleId: string;
  playerId: string;
  disconnectedAt: number;
  graceTimer: NodeJS.Timeout;
}

@Injectable()
export class BattleGraceBufferService {
  private readonly logger = new Logger(BattleGraceBufferService.name);
  private graceBuffers = new Map<string, DisconnectBufferEntry>(); // `${battleId}:${playerId}` -> Entry
  private readonly gracePeriodMs = 30000; // 30 seconds

  /**
   * Registers a momentary socket disconnection and starts the 30s grace countdown
   */
  startGraceBuffer(battleId: string, playerId: string, onForfeit: () => void): void {
    const key = `${battleId}:${playerId}`;
    this.clearGraceBuffer(battleId, playerId);

    this.logger.warn(`Player ${playerId} disconnected from battle ${battleId}. Starting 30s grace window...`);

    const timer = setTimeout(() => {
      this.logger.error(`Grace window expired for player ${playerId} in battle ${battleId}. Forfeiting match.`);
      this.graceBuffers.delete(key);
      onForfeit();
    }, this.gracePeriodMs);

    this.graceBuffers.set(key, {
      battleId,
      playerId,
      disconnectedAt: Date.now(),
      graceTimer: timer,
    });
  }

  /**
   * Cancels grace buffer when player successfully reconnects within 30s
   */
  clearGraceBuffer(battleId: string, playerId: string): boolean {
    const key = `${battleId}:${playerId}`;
    const entry = this.graceBuffers.get(key);
    if (!entry) return false;

    clearTimeout(entry.graceTimer);
    this.graceBuffers.delete(key);
    this.logger.log(`Player ${playerId} reconnected to battle ${battleId} in time. Match resumed!`);
    return true;
  }
}
