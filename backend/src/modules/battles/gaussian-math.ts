export interface GaussianRating {
  playerId: string;
  mu: number; // Mean skill, default 25.0
  sigma: number; // Uncertainty, default 8.333
  conservativeRating: number; // mu - 3 * sigma
  lastActiveDate?: string;
}

export const DEFAULT_MU = 25.0;
export const DEFAULT_SIGMA = 25.0 / 3.0; // 8.333333
export const BETA = 25.0 / 6.0; // 4.166667
export const TAU = 25.0 / 300.0; // 0.083333 (additive dynamics per inactive day)
export const DRAW_MARGIN = 0.1;

export class GaussianMath {
  /**
   * Standard Normal PDF: phi(x)
   */
  static phi(x: number): number {
    return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2.0);
  }

  /**
   * Standard Normal Cumulative Distribution Function: Phi(x)
   */
  static normalCdf(x: number): number {
    const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp((-x * x) / 2.0);
    const prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1.0 - prob : prob;
  }

  /**
   * Truncated Gaussian mean adjustment factor: V(delta, epsilon)
   */
  static vWin(delta: number, margin = 0): number {
    const denom = Math.max(1e-6, this.normalCdf(delta - margin));
    return this.phi(delta - margin) / denom;
  }

  /**
   * Truncated Gaussian variance adjustment factor: W(delta, epsilon)
   */
  static wWin(delta: number, margin = 0): number {
    const v = this.vWin(delta, margin);
    return v * (v + (delta - margin));
  }

  /**
   * Computes conservative rating for leaderboard displays: R = max(0, mu - 3 * sigma)
   */
  static calculateConservativeRating(mu: number, sigma: number): number {
    return Number(Math.max(0, mu - 3 * sigma).toFixed(3));
  }

  /**
   * Inactivity confidence decay:
   * Increases uncertainty (sigma) without altering estimated mean skill (mu).
   * sigma_new = sqrt(sigma^2 + t * tau^2)
   */
  static decayInactivity(sigma: number, inactiveDays: number, tau = TAU): number {
    if (inactiveDays <= 0) return sigma;
    const newSigmaSq = sigma * sigma + inactiveDays * (tau * tau);
    // Bounded above by initial uncertainty (DEFAULT_SIGMA)
    return Number(Math.min(DEFAULT_SIGMA, Math.sqrt(newSigmaSq)).toFixed(4));
  }
}
