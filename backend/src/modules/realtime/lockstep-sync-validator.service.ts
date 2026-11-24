import { Injectable } from '@nestjs/common';

export interface TurnAction {
  turnId: number;
  playerId: string;
  actionHash: string;
}

@Injectable()
export class LockstepSyncValidatorService {
  private readonly turnHashes = new Map<number, Map<string, string>>();

  public recordPlayerAction(turnId: number, playerId: string, actionHash: string): { turnResolved: boolean; desyncDetected: boolean } {
    let players = this.turnHashes.get(turnId);
    if (!players) {
      players = new Map();
      this.turnHashes.set(turnId, players);
    }
    players.set(playerId, actionHash);

    // If 2+ players submitted, verify lockstep checksum agreement
    if (players.size >= 2) {
      const hashes = Array.from(players.values());
      const first = hashes[0];
      const desync = hashes.some((h) => h !== first);
      return { turnResolved: true, desyncDetected: desync };
    }

    return { turnResolved: false, desyncDetected: false };
  }
}
