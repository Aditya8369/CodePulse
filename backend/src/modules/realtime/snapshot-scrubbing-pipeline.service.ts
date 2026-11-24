import { Injectable } from '@nestjs/common';

export interface BattleSnapshot {
  tick: number;
  timestamp: number;
  stateJson: string;
}

@Injectable()
export class SnapshotScrubbingPipelineService {
  private readonly snapshots = new Map<string, BattleSnapshot[]>();

  public recordSnapshot(matchId: string, snapshot: BattleSnapshot): void {
    const list = this.snapshots.get(matchId) || [];
    list.push(snapshot);
    // Retain up to 3600 snapshots (e.g. 1 hour at 1Hz or 60s at 60Hz)
    if (list.length > 3600) list.shift();
    this.snapshots.set(matchId, list);
  }

  public scrubToTick(matchId: string, targetTick: number): BattleSnapshot | null {
    const list = this.snapshots.get(matchId) || [];
    if (list.length === 0) return null;

    // Binary search for closest tick <= targetTick
    let low = 0;
    let high = list.length - 1;
    let best = list[0];

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (list[mid].tick <= targetTick) {
        best = list[mid];
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }
}
