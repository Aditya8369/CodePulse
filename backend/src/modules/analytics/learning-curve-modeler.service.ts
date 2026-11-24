export class LearningCurveModelerService {
  public computeRetainedSkill(initialSkillScore: number, daysSincePractice: number, halfLifeDays: number = 180): number {
    const decayFactor = Math.pow(0.5, daysSincePractice / halfLifeDays);
    return Math.round(initialSkillScore * decayFactor);
  }
}
