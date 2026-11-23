export interface PlayerRating {
  id: string;
  mu: number; // Mean skill, default 25.0
  sigma: number; // Uncertainty, default 8.333
  languages?: string[];
}

export interface PlayerSynergyEdge {
  playerA: string;
  playerB: string;
  coopMatches: number;
  coopWins: number;
  synergyScore: number; // 0.0 to 1.0
}

export interface TeamComposition {
  team1: PlayerRating[];
  team2: PlayerRating[];
  team1Synergy: number;
  team2Synergy: number;
  expectedWinProbTeam1: number;
  expectedWinProbTeam2: number;
  balanceDelta: number; // |winProb - 0.5|
}

export const BETA = 4.166; // Skill dispersion parameter (half of initial sigma)

/**
 * Standard Normal Gaussian cumulative distribution function (CDF).
 */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - prob : prob;
}

export class SynergyGraphEvaluator {
  private readonly nodes = new Map<string, PlayerRating>();
  private readonly edges = new Map<string, PlayerSynergyEdge>();

  addPlayer(player: PlayerRating): void {
    this.nodes.set(player.id, player);
  }

  addSynergy(playerA: string, playerB: string, coopMatches: number, coopWins: number): void {
    const key = this.getEdgeKey(playerA, playerB);
    const winRate = coopMatches > 0 ? coopWins / coopMatches : 0.5;
    const confidence = Math.min(1.0, coopMatches / 10);
    const synergyScore = Number((0.5 * (1 - confidence) + winRate * confidence).toFixed(3));

    this.edges.set(key, {
      playerA,
      playerB,
      coopMatches,
      coopWins,
      synergyScore,
    });
  }

  getSynergyScore(playerA: string, playerB: string): number {
    const key = this.getEdgeKey(playerA, playerB);
    const edge = this.edges.get(key);
    if (edge) return edge.synergyScore;

    // Default to slight language synergy if preferred languages overlap
    const pA = this.nodes.get(playerA);
    const pB = this.nodes.get(playerB);
    if (pA?.languages && pB?.languages) {
      const overlap = pA.languages.some((lang) => pB.languages?.includes(lang));
      return overlap ? 0.55 : 0.5;
    }
    return 0.5;
  }

  private getEdgeKey(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  /**
   * Calculates total team internal chemistry/synergy score.
   */
  calculateTeamSynergy(team: PlayerRating[]): number {
    if (team.length <= 1) return 0.5;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        sum += this.getSynergyScore(team[i].id, team[j].id);
        count++;
      }
    }
    return count > 0 ? Number((sum / count).toFixed(3)) : 0.5;
  }

  /**
   * Evaluates expected win probability of Team 1 over Team 2.
   */
  calculateWinProbability(team1: PlayerRating[], team2: PlayerRating[]): number {
    const syn1 = this.calculateTeamSynergy(team1);
    const syn2 = this.calculateTeamSynergy(team2);

    // Synergy bonus contributes up to ±2.0 skill points
    const mu1 = team1.reduce((acc, p) => acc + p.mu, 0) + (syn1 - 0.5) * 4.0;
    const mu2 = team2.reduce((acc, p) => acc + p.mu, 0) + (syn2 - 0.5) * 4.0;

    const var1 = team1.reduce((acc, p) => acc + p.sigma * p.sigma, 0);
    const var2 = team2.reduce((acc, p) => acc + p.sigma * p.sigma, 0);

    const denom = Math.sqrt(2 * (BETA * BETA) + var1 + var2);
    const delta = (mu1 - mu2) / Math.max(0.001, denom);

    return Number(normalCdf(delta).toFixed(4));
  }

  /**
   * Optimal graph partitioning for 6 players into two 3v3 teams minimizing |P(win) - 0.5|.
   */
  partition3v3(players: PlayerRating[]): TeamComposition {
    if (players.length !== 6) {
      throw new Error(`Expected exactly 6 players for 3v3 partitioning, received ${players.length}`);
    }

    players.forEach((p) => this.addPlayer(p));

    // Combination of 6 choose 3 = 20 total partitions (10 unique pairings)
    const combinations: number[][] = [
      [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 1, 5],
      [0, 2, 3], [0, 2, 4], [0, 2, 5],
      [0, 3, 4], [0, 3, 5],
      [0, 4, 5],
    ];

    let bestComp: TeamComposition | null = null;
    let minDelta = Infinity;

    for (const t1Indices of combinations) {
      const t1 = t1Indices.map((i) => players[i]);
      const t2 = players.filter((_, idx) => !t1Indices.includes(idx));

      const winProb = this.calculateWinProbability(t1, t2);
      const delta = Math.abs(winProb - 0.5);

      if (delta < minDelta) {
        minDelta = delta;
        bestComp = {
          team1: t1,
          team2: t2,
          team1Synergy: this.calculateTeamSynergy(t1),
          team2Synergy: this.calculateTeamSynergy(t2),
          expectedWinProbTeam1: winProb,
          expectedWinProbTeam2: Number((1 - winProb).toFixed(4)),
          balanceDelta: Number(delta.toFixed(4)),
        };
      }
    }

    return bestComp!;
  }
}
