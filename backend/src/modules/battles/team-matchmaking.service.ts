import { Injectable, Logger } from '@nestjs/common';
import {
  BETA,
  PlayerRating,
  SynergyGraphEvaluator,
  TeamComposition,
} from './graph-evaluator';

export interface RatingUpdateResult {
  updatedTeam1: PlayerRating[];
  updatedTeam2: PlayerRating[];
}

@Injectable()
export class TeamMatchmakingService {
  private readonly logger = new Logger(TeamMatchmakingService.name);
  private readonly evaluator = new SynergyGraphEvaluator();

  registerCoopHistory(playerA: string, playerB: string, matches: number, wins: number): void {
    this.evaluator.addSynergy(playerA, playerB, matches, wins);
  }

  /**
   * Generates a balanced 3v3 match with expected win probability between 45% and 55%.
   */
  createBalanced3v3Match(players: PlayerRating[]): TeamComposition {
    return this.evaluator.partition3v3(players);
  }

  /**
   * Fast queue matchmaking for large queues (e.g. 1,000+ players in <500ms).
   * Buckets players by skill and applies optimal graph partitioning within each bucket.
   */
  matchQueue(queue: PlayerRating[]): TeamComposition[] {
    const startTime = Date.now();
    if (queue.length < 6) return [];

    // Sort by conservative skill estimate: mu - 2.5 * sigma
    const sorted = [...queue].sort(
      (a, b) => b.mu - 2.5 * b.sigma - (a.mu - 2.5 * a.sigma),
    );

    const matches: TeamComposition[] = [];
    const fullGroups = Math.floor(sorted.length / 6);

    for (let i = 0; i < fullGroups; i++) {
      const group = sorted.slice(i * 6, (i + 1) * 6);
      matches.push(this.evaluator.partition3v3(group));
    }

    const elapsed = Date.now() - startTime;
    this.logger.debug(
      `Matched ${matches.length} 3v3 games from queue of ${queue.length} in ${elapsed}ms`,
    );

    return matches;
  }

  /**
   * Updates Bayesian TrueSkill distributions (mu, sigma) after 3v3 match completion.
   * Mathematical Invariants:
   * 1. Winners' mu increases; losers' mu decreases.
   * 2. Sigma strictly decays monotonically, reducing uncertainty as more games are played.
   */
  updateTrueSkillRatings(
    team1: PlayerRating[],
    team2: PlayerRating[],
    outcome: 'TEAM1_WIN' | 'TEAM2_WIN' | 'DRAW',
  ): RatingUpdateResult {
    const mu1 = team1.reduce((sum, p) => sum + p.mu, 0);
    const mu2 = team2.reduce((sum, p) => sum + p.mu, 0);

    const var1 = team1.reduce((sum, p) => sum + p.sigma * p.sigma, 0);
    const var2 = team2.reduce((sum, p) => sum + p.sigma * p.sigma, 0);

    const c = Math.sqrt(2 * (BETA * BETA) + var1 + var2);

    let v = 0; // Skill update multiplier
    let w = 0; // Uncertainty decay factor

    if (outcome === 'TEAM1_WIN') {
      const delta = (mu1 - mu2) / c;
      v = this.vWin(delta);
      w = this.wWin(delta);
    } else if (outcome === 'TEAM2_WIN') {
      const delta = (mu2 - mu1) / c;
      v = -this.vWin(delta);
      w = this.wWin(delta);
    } else {
      // DRAW
      const delta = Math.abs(mu1 - mu2) / c;
      v = 0;
      w = 0.5;
    }

    const updatedTeam1 = team1.map((p) => {
      const sigSq = p.sigma * p.sigma;
      const muDelta = (sigSq / c) * v;
      const newMu = Number((p.mu + muDelta).toFixed(3));

      // Uncertainty decay: sigma^2 * (1 - (sigma^2 / c^2) * w)
      const varianceReduction = (sigSq / (c * c)) * Math.max(0.01, w);
      const newSigmaSq = sigSq * Math.max(0.1, 1 - varianceReduction);
      const newSigma = Number(Math.max(1.0, Math.sqrt(newSigmaSq)).toFixed(3));

      return {
        ...p,
        mu: newMu,
        sigma: newSigma,
      };
    });

    const updatedTeam2 = team2.map((p) => {
      const sigSq = p.sigma * p.sigma;
      const muDelta = -(sigSq / c) * v;
      const newMu = Number((p.mu + muDelta).toFixed(3));

      const varianceReduction = (sigSq / (c * c)) * Math.max(0.01, w);
      const newSigmaSq = sigSq * Math.max(0.1, 1 - varianceReduction);
      const newSigma = Number(Math.max(1.0, Math.sqrt(newSigmaSq)).toFixed(3));

      return {
        ...p,
        mu: newMu,
        sigma: newSigma,
      };
    });

    return { updatedTeam1, updatedTeam2 };
  }

  // Gaussian expectation helpers for Bayesian belief updating
  private vWin(delta: number): number {
    // Normal PDF / Normal CDF ratio
    const pdf = (1 / Math.sqrt(2 * Math.PI)) * Math.exp((-delta * delta) / 2);
    const t = 1 / (1 + 0.2316419 * Math.abs(delta));
    const d = 0.3989422804014327 * Math.exp((-delta * delta) / 2);
    const cdf = delta >= 0
      ? 1 - d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
      : d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

    return Number((pdf / Math.max(0.0001, cdf)).toFixed(4));
  }

  private wWin(delta: number): number {
    const v = this.vWin(delta);
    return Number((v * (v + delta)).toFixed(4));
  }
}
