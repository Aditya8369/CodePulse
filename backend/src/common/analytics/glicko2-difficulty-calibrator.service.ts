export interface ChallengeGlickoRating {
  challengeId: string;
  rating: number; // default 1500
  rd: number; // rating deviation, default 350
  volatility: number; // default 0.06
}

export class Glicko2DifficultyCalibratorService {
  private readonly scale = 173.7178;

  public updateRating(
    current: ChallengeGlickoRating,
    competitorRating: number,
    competitorPassed: boolean
  ): ChallengeGlickoRating {
    // Challenge score: competitor passing means challenge failed (0), competitor failing means challenge won (1)
    const actualScore = competitorPassed ? 0 : 1;

    // Convert to Glicko-2 scale
    const mu = (current.rating - 1500) / this.scale;
    const phi = current.rd / this.scale;
    const opponentMu = (competitorRating - 1500) / this.scale;
    const opponentPhi = 100 / this.scale;

    // g(phi) = 1 / sqrt(1 + 3*phi^2 / pi^2)
    const gOpponent = 1 / Math.sqrt(1 + (3 * opponentPhi * opponentPhi) / (Math.PI * Math.PI));
    // E(mu, opponentMu, opponentPhi) = 1 / (1 + exp(-g * (mu - opponentMu)))
    const expectedScore = 1 / (1 + Math.exp(-gOpponent * (mu - opponentMu)));

    // Variance v
    const v = 1 / (gOpponent * gOpponent * expectedScore * (1 - expectedScore));

    // Delta = v * g * (actualScore - expectedScore)
    const delta = v * gOpponent * (actualScore - expectedScore);

    // Update phi' and mu'
    const newPhi = 1 / Math.sqrt(1 / (phi * phi) + 1 / v);
    const newMu = mu + newPhi * newPhi * (gOpponent * (actualScore - expectedScore));

    // Convert back to original scale
    const newRating = Math.round((newMu * this.scale + 1500) * 10) / 10;
    const newRd = Math.max(30, Math.round((newPhi * this.scale) * 10) / 10);

    return {
      challengeId: current.challengeId,
      rating: newRating,
      rd: newRd,
      volatility: current.volatility
    };
  }
}
