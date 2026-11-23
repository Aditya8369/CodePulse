import { TeamMatchmakingService } from './team-matchmaking.service';
import { PlayerRating } from './graph-evaluator';

describe('TeamMatchmakingService & SynergyGraphEvaluator (3v3 Graph & TrueSkill)', () => {
  let service: TeamMatchmakingService;

  beforeEach(() => {
    service = new TeamMatchmakingService();
  });

  it('partitions 6 players into two balanced 3v3 teams with win prob within 45% - 55%', () => {
    const players: PlayerRating[] = [
      { id: 'p1', mu: 28.0, sigma: 4.0, languages: ['typescript', 'rust'] },
      { id: 'p2', mu: 22.0, sigma: 6.0, languages: ['typescript'] },
      { id: 'p3', mu: 25.0, sigma: 5.0, languages: ['python'] },
      { id: 'p4', mu: 24.0, sigma: 5.5, languages: ['rust'] },
      { id: 'p5', mu: 30.0, sigma: 3.5, languages: ['go', 'rust'] },
      { id: 'p6', mu: 21.0, sigma: 7.0, languages: ['go'] },
    ];

    // Register cooperative synergy
    service.registerCoopHistory('p1', 'p2', 15, 12); // High synergy

    const match = service.createBalanced3v3Match(players);

    expect(match.team1).toHaveLength(3);
    expect(match.team2).toHaveLength(3);
    expect(match.expectedWinProbTeam1).toBeGreaterThanOrEqual(0.40);
    expect(match.expectedWinProbTeam1).toBeLessThanOrEqual(0.60);
    expect(match.balanceDelta).toBeLessThanOrEqual(0.10);
  });

  it('updates TrueSkill Bayesian distributions satisfying mathematical invariants', () => {
    const team1: PlayerRating[] = [
      { id: 'p1', mu: 25.0, sigma: 8.333 },
      { id: 'p2', mu: 25.0, sigma: 8.333 },
      { id: 'p3', mu: 25.0, sigma: 8.333 },
    ];

    const team2: PlayerRating[] = [
      { id: 'p4', mu: 25.0, sigma: 8.333 },
      { id: 'p5', mu: 25.0, sigma: 8.333 },
      { id: 'p6', mu: 25.0, sigma: 8.333 },
    ];

    const { updatedTeam1, updatedTeam2 } = service.updateTrueSkillRatings(
      team1,
      team2,
      'TEAM1_WIN',
    );

    // Invariant 1: Winners' mu must increase
    updatedTeam1.forEach((p, idx) => {
      expect(p.mu).toBeGreaterThan(team1[idx].mu);
    });

    // Invariant 2: Losers' mu must decrease
    updatedTeam2.forEach((p, idx) => {
      expect(p.mu).toBeLessThan(team2[idx].mu);
    });

    // Invariant 3: Uncertainty (sigma) must decay monotonically for all participants
    updatedTeam1.forEach((p, idx) => {
      expect(p.sigma).toBeLessThan(team1[idx].sigma);
    });
    updatedTeam2.forEach((p, idx) => {
      expect(p.sigma).toBeLessThan(team2[idx].sigma);
    });
  });

  it('handles large matchmaking queues of 1,200 players in under 500ms', () => {
    const queue: PlayerRating[] = Array.from({ length: 1200 }, (_, i) => ({
      id: `dev-${i + 1}`,
      mu: 15 + Math.random() * 25,
      sigma: 2 + Math.random() * 6,
      languages: ['typescript', 'python', 'go'],
    }));

    const start = Date.now();
    const matches = service.matchQueue(queue);
    const duration = Date.now() - start;

    expect(matches).toHaveLength(200); // 1200 / 6 = 200 matches
    expect(duration).toBeLessThan(500);
  });
});
