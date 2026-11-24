export class DeveloperBurnoutDetectorService {
  public evaluateFatigue(lateNightCommitRatio: number, weeklyHours: number): {
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    if (weeklyHours > 60 || lateNightCommitRatio > 0.40) {
      return { risk: 'HIGH' };
    } else if (weeklyHours > 45 || lateNightCommitRatio > 0.20) {
      return { risk: 'MEDIUM' };
    }
    return { risk: 'LOW' };
  }
}
