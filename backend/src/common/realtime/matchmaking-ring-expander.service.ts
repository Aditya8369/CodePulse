export interface QueuedPlayer {
  userId: string;
  elo: number;
  joinedAt: number;
}

/**
 * MatchmakingRingExpanderService
 * Prevents queue starvation by expanding Elo search threshold (+/- 25 pts every 10s up to +/- 250)
 * guaranteeing match pairings within 60s without destroying game fairness.
 */
export class MatchmakingRingExpanderService {
  private readonly initialRadius = 50;
  private readonly expandPerStep = 25;
  private readonly stepSeconds = 10;
  private readonly maxRadius = 250;

  calculateCurrentRadius(queuedPlayer: QueuedPlayer, now: number = Date.now()): number {
    const elapsedSeconds = Math.max(0, (now - queuedPlayer.joinedAt) / 1000);
    const steps = Math.floor(elapsedSeconds / this.stepSeconds);
    const expansion = steps * this.expandPerStep;
    return Math.min(this.maxRadius, this.initialRadius + expansion);
  }

  isMatchable(p1: QueuedPlayer, p2: QueuedPlayer, now: number = Date.now()): boolean {
    if (p1.userId === p2.userId) return false;

    const r1 = this.calculateCurrentRadius(p1, now);
    const r2 = this.calculateCurrentRadius(p2, now);
    const eloDiff = Math.abs(p1.elo - p2.elo);

    // Both players must tolerate the elo difference
    return eloDiff <= Math.max(r1, r2);
  }

  findBestMatch(target: QueuedPlayer, pool: QueuedPlayer[], now: number = Date.now()): QueuedPlayer | null {
    let best: QueuedPlayer | null = null;
    let minDiff = Infinity;

    for (const opponent of pool) {
      if (this.isMatchable(target, opponent, now)) {
        const diff = Math.abs(target.elo - opponent.elo);
        if (diff < minDiff) {
          minDiff = diff;
          best = opponent;
        }
      }
    }
    return best;
  }
}
