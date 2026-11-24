export class SpotTerminationWatchdogService {
  private terminationNoticed: boolean = false;

  public handleNotice(): { action: string; remainingSeconds: number } {
    this.terminationNoticed = true;
    return {
      action: 'COMMENCE_EMERGENCY_MIGRATION',
      remainingSeconds: 120
    };
  }

  public isTerminating(): boolean {
    return this.terminationNoticed;
  }
}
