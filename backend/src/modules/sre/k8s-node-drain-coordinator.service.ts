export class K8sNodeDrainCoordinatorService {
  private activeMatches = new Set<string>();

  public registerMatch(matchId: string): void {
    this.activeMatches.add(matchId);
  }

  public completeMatch(matchId: string): void {
    this.activeMatches.delete(matchId);
  }

  public canDrainPod(): boolean {
    return this.activeMatches.size === 0;
  }

  public getActiveMatchCount(): number {
    return this.activeMatches.size;
  }
}
