export class TeamCollaborationIndexService {
  public calculateIndex(avgReviewHours: number, mergeVelocityPrsPerDay: number): number {
    // Faster reviews and higher merge velocities yield higher scores (0 to 100)
    const reviewScore = Math.max(0, 50 - avgReviewHours);
    const velocityScore = Math.min(50, mergeVelocityPrsPerDay * 10);
    return Math.min(100, Math.round(reviewScore + velocityScore));
  }
}
