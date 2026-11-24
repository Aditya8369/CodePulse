export interface ReviewActivity {
  reviewerId: string;
  authorId: string;
  reviewerTeam: string;
  authorTeam: string;
  turnaroundHours: number;
  commentCount: number;
}

export interface CollaborationRating {
  reviewerId: string;
  score: number; // 0 - 100
  reviewCount: number;
  avgTurnaroundHours: number;
  crossTeamRatio: number;
  badge: 'Collaborator' | 'Peer Champion' | 'Knowledge Bridge';
}

export class CollaborationIndexService {
  public computeIndex(activities: ReviewActivity[]): Map<string, CollaborationRating> {
    const byReviewer = new Map<string, ReviewActivity[]>();

    for (const act of activities) {
      const list = byReviewer.get(act.reviewerId) || [];
      list.push(act);
      byReviewer.set(act.reviewerId, list);
    }

    const ratings = new Map<string, CollaborationRating>();

    for (const [reviewerId, acts] of byReviewer.entries()) {
      const count = acts.length;
      const totalTurnaround = acts.reduce((acc, a) => acc + a.turnaroundHours, 0);
      const avgTurnaround = totalTurnaround / count;
      const crossTeamCount = acts.filter(a => a.reviewerTeam !== a.authorTeam).length;
      const crossTeamRatio = crossTeamCount / count;
      const avgComments = acts.reduce((acc, a) => acc + a.commentCount, 0) / count;

      // Score formula:
      // Turnaround component: <= 4h = 40 pts, <= 24h = 25 pts, > 24h = 10 pts
      let turnaroundScore = 10;
      if (avgTurnaround <= 4) turnaroundScore = 40;
      else if (avgTurnaround <= 24) turnaroundScore = 25;

      // Cross pollination component: up to 30 pts
      const crossScore = Math.min(30, Math.round(crossTeamRatio * 30));

      // Comment depth component: up to 30 pts
      const commentScore = Math.min(30, Math.round(avgComments * 5));

      const totalScore = Math.min(100, turnaroundScore + crossScore + commentScore);

      let badge: CollaborationRating['badge'] = 'Collaborator';
      if (totalScore >= 80) badge = 'Peer Champion';
      else if (crossTeamRatio >= 0.5) badge = 'Knowledge Bridge';

      ratings.set(reviewerId, {
        reviewerId,
        score: totalScore,
        reviewCount: count,
        avgTurnaroundHours: Math.round(avgTurnaround * 10) / 10,
        crossTeamRatio: Math.round(crossTeamRatio * 100) / 100,
        badge
      });
    }

    return ratings;
  }
}
