import { TrueSkill2Service } from './trueskill2.service';
import { DEFAULT_MU, DEFAULT_SIGMA, GaussianMath } from './gaussian-math';

describe('TrueSkill2Service & GaussianMath (Bayesian Multi-Participant Ranking Engine)', () => {
  let service: TrueSkill2Service;

  beforeEach(() => {
    service = new TrueSkill2Service();
  });

  it('updates ratings for 4-player free-for-all match respecting rankings', () => {
    const players = ['p1-winner', 'p2-second', 'p3-third', 'p4-fourth'];
    const results = service.updateMultiParticipantMatch(players);

    expect(results).toHaveLength(4);

    const winner = results[0];
    const second = results[1];
    const fourth = results[3];

    // Winner's mean skill increases
    expect(winner.newMu).toBeGreaterThan(winner.previousMu);
    // 4th place's mean skill decreases
    expect(fourth.newMu).toBeLessThan(fourth.previousMu);

    // Uncertainty decays for all active participants
    results.forEach((r) => {
      expect(r.newSigma).toBeLessThan(r.previousSigma);
      expect(r.conservativeRating).toBe(GaussianMath.calculateConservativeRating(r.newMu, r.newSigma));
    });
  });

  it('inflates uncertainty (sigma) for inactive players without lowering estimated mean skill (mu)', () => {
    const player = service.getOrCreateRating('p-inactive-user');
    const initialMu = player.mu;
    const initialSigma = 4.0; // Experienced player with low uncertainty
    player.sigma = initialSigma;

    // Player goes inactive for 60 days
    const decayed = service.applyInactivityDecay('p-inactive-user', 60);

    expect(decayed.mu).toBe(initialMu); // Mu is strictly preserved!
    expect(decayed.sigma).toBeGreaterThan(initialSigma); // Sigma increased
    expect(decayed.conservativeRating).toBeLessThan(initialMu - 3 * initialSigma);
  });

  it('demonstrates fast skill convergence in under 10 matches compared to Elo', () => {
    const benchmark = service.benchmarkConvergence(10, 30);
    expect(benchmark.roundsSimulated).toBe(10);
    expect(benchmark.trueSkillConvergedUnder10Matches).toBe(true);
    expect(benchmark.trueSkillErrorPercent).toBeLessThan(15.0);
  });

  it('calculates Gaussian PDF and CDF values accurately', () => {
    expect(GaussianMath.normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(GaussianMath.normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(GaussianMath.phi(0)).toBeCloseTo(0.3989, 3);
  });
});
