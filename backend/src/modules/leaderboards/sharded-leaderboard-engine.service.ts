export class ShardedLeaderboardEngineService {
  private userScores = new Map<string, number>();

  public updateScore(userId: string, score: number): void {
    this.userScores.set(userId, score);
  }

  public getRank(userId: string): number {
    const targetScore = this.userScores.get(userId);
    if (targetScore === undefined) return -1;

    let rank = 1;
    for (const score of this.userScores.values()) {
      if (score > targetScore) {
        rank++;
      }
    }
    return rank;
  }
}
