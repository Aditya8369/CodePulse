export class TournamentBracketEngineService {
  public generateSingleEliminationRound1(playerIds: string[]): [string, string][] {
    const pairings: [string, string][] = [];
    for (let i = 0; i < playerIds.length / 2; i++) {
      pairings.push([playerIds[i], playerIds[playerIds.length - 1 - i]]);
    }
    return pairings;
  }
}
