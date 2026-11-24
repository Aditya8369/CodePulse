import { Injectable } from '@nestjs/common';

export interface GameState {
  tick: number;
  entities: Record<string, { x: number; y: number; hp: number }>;
}

@Injectable()
export class SpectatorDeltaBroadcasterService {
  private lastState: GameState | null = null;

  public computeDelta(nextState: GameState): { tick: number; changes: Record<string, Partial<{ x: number; y: number; hp: number }>> } {
    if (!this.lastState) {
      this.lastState = nextState;
      return { tick: nextState.tick, changes: nextState.entities };
    }

    const changes: Record<string, Partial<{ x: number; y: number; hp: number }>> = {};
    for (const [id, current] of Object.entries(nextState.entities)) {
      const prev = this.lastState.entities[id];
      if (!prev) {
        changes[id] = current;
      } else {
        const diff: Partial<{ x: number; y: number; hp: number }> = {};
        if (prev.x !== current.x) diff.x = current.x;
        if (prev.y !== current.y) diff.y = current.y;
        if (prev.hp !== current.hp) diff.hp = current.hp;
        if (Object.keys(diff).length > 0) changes[id] = diff;
      }
    }

    this.lastState = nextState;
    return { tick: nextState.tick, changes };
  }
}
