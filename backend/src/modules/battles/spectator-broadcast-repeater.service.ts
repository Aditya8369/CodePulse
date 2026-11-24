export class SpectatorBroadcastRepeaterService {
  public computeDelta(previousState: Record<string, any>, currentState: Record<string, any>): Record<string, any> {
    const delta: Record<string, any> = {};
    for (const [key, val] of Object.entries(currentState)) {
      if (previousState[key] !== val) {
        delta[key] = val;
      }
    }
    return delta;
  }
}
