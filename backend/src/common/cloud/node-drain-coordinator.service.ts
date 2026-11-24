export interface BattleExecutionState {
  battleId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startTime: number;
}

export class NodeDrainCoordinatorService {
  private activeBattles = new Map<string, BattleExecutionState>();
  private isCordoned = false;

  constructor(private readonly maxDrainWaitMs = 300000) {} // 5 minutes max

  public registerBattle(battleId: string): boolean {
    if (this.isCordoned) {
      return false; // Node is cordoned, reject new battle assignments
    }
    this.activeBattles.set(battleId, {
      battleId,
      status: 'IN_PROGRESS',
      startTime: Date.now()
    });
    return true;
  }

  public completeBattle(battleId: string): void {
    this.activeBattles.delete(battleId);
  }

  public async initiateNodeDrain(): Promise<{ drainedCleanly: boolean; activeBattlesRemaining: number }> {
    // Cordon node to stop new incoming tasks
    this.isCordoned = true;

    const start = Date.now();
    while (this.activeBattles.size > 0 && (Date.now() - start) < this.maxDrainWaitMs) {
      // Wait for in-progress battles to finish naturally
      await new Promise(r => setTimeout(r, 50));
    }

    return {
      drainedCleanly: this.activeBattles.size === 0,
      activeBattlesRemaining: this.activeBattles.size
    };
  }

  public isNodeCordoned(): boolean {
    return this.isCordoned;
  }
}
