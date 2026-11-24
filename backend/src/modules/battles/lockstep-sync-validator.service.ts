export interface BattleTurn {
  turnIndex: number;
  playerActionHash: string;
  expectedStateHash: string;
}

export class LockstepSyncValidatorService {
  public validateTurn(currentTurn: number, incomingTurn: BattleTurn, previousStateHash: string): boolean {
    if (incomingTurn.turnIndex !== currentTurn + 1) {
      return false; // Desynchronized turn counter
    }
    return incomingTurn.expectedStateHash === previousStateHash;
  }
}
