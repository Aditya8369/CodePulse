/**
 * Architecture Service 79: Challenge Submission Queue with Priority Bypass
 * Subsystem: Live Tournament Priority Lane
 */

export class TournamentPriorityBypassQueueService {
  private priorityLane: string[] = [];
  private standardLane: string[] = [];

  public enqueueSubmission(submissionId: string, isLiveTournament = false): void {
    if (isLiveTournament) {
      this.priorityLane.push(submissionId);
    } else {
      this.standardLane.push(submissionId);
    }
  }

  public dequeueNext(): string | undefined {
    return this.priorityLane.shift() || this.standardLane.shift();
  }

  public get pendingPriority(): number {
    return this.priorityLane.length;
  }
}
