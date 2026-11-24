export class Glicko2MatchmakingSolverService {
  public computeAcceptableRatingDelta(waitSeconds: number, baseTolerance: number = 50): number {
    // Expand rating range by 15 points every 5 seconds of wait time
    const expansionSteps = Math.floor(waitSeconds / 5);
    return Math.min(baseTolerance + expansionSteps * 15, 500);
  }

  public canMatch(ratingA: number, ratingB: number, waitSeconds: number): boolean {
    const delta = Math.abs(ratingA - ratingB);
    const tolerance = this.computeAcceptableRatingDelta(waitSeconds);
    return delta <= tolerance;
  }
}
