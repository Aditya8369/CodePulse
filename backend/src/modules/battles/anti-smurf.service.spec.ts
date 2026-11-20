import { AntiSmurfService, FAST_MMR_PLACEMENT_MULTIPLIER } from './anti-smurf.service';
import { BattlesService } from './battles.service';
import { AlgorithmicComplexityClass } from './dto/match-result.dto';

describe('AntiSmurfService & Fast MMR Placement', () => {
  let service: AntiSmurfService;

  beforeEach(() => {
    service = new AntiSmurfService();
  });

  it('extracts normalized 5-feature vectors and flags veteran smurfs with probability > 0.85', () => {
    const smurfClassification = service.classifyPlacementMatch({
      battleId: 'battle-place-1',
      userId: 'user-smurf-01',
      timeToFirstSubmitSec: 28,
      typingSpeedWpm: 124,
      cyclomaticEfficiency: 0.95,
      firstAttemptPassRate: 1.0,
      selectedComplexity: AlgorithmicComplexityClass.O_N,
      placementMatchNumber: 1,
    });

    expect(smurfClassification.smurfProbability).toBeGreaterThan(0.85);
    expect(smurfClassification.isSmurfFlagged).toBe(true);
    expect(smurfClassification.mmrMultiplier).toBe(FAST_MMR_PLACEMENT_MULTIPLIER);
    expect(smurfClassification.constructiveNotice.banned).toBe(false);
    expect(smurfClassification.constructiveNotice.action).toBe('FAST_MMR_PLACEMENT');
  });

  it('keeps genuine beginner placement players unflagged (probability <= 0.85, 1x MMR)', () => {
    const beginnerClassification = service.classifyPlacementMatch({
      battleId: 'battle-place-2',
      userId: 'user-newbie-01',
      timeToFirstSubmitSec: 235,
      typingSpeedWpm: 41,
      cyclomaticEfficiency: 0.58,
      firstAttemptPassRate: 0.4,
      selectedComplexity: AlgorithmicComplexityClass.O_N_SQUARED,
      placementMatchNumber: 1,
    });

    expect(beginnerClassification.smurfProbability).toBeLessThanOrEqual(0.85);
    expect(beginnerClassification.isSmurfFlagged).toBe(false);
    expect(beginnerClassification.mmrMultiplier).toBe(1);
  });

  it('achieves >= 92% classification precision across synthetic beginner vs smurf cohorts and promotes smurfs within 5 games', () => {
    const cohort = [
      // 15 veteran smurf samples
      ...Array.from({ length: 15 }, (_, idx) => ({
        isActualSmurf: true,
        dto: {
          battleId: `b-s-${idx}`,
          userId: `smurf-${idx}`,
          timeToFirstSubmitSec: 25 + (idx % 30),
          typingSpeedWpm: 105 + (idx % 30),
          cyclomaticEfficiency: 0.88 + (idx % 10) * 0.01,
          firstAttemptPassRate: 0.92 + (idx % 8) * 0.01,
          selectedComplexity: AlgorithmicComplexityClass.O_N,
        },
      })),
      // 15 genuine beginner samples
      ...Array.from({ length: 15 }, (_, idx) => ({
        isActualSmurf: false,
        dto: {
          battleId: `b-n-${idx}`,
          userId: `newbie-${idx}`,
          timeToFirstSubmitSec: 180 + idx * 12,
          typingSpeedWpm: 32 + (idx % 25),
          cyclomaticEfficiency: 0.45 + (idx % 20) * 0.01,
          firstAttemptPassRate: 0.25 + (idx % 4) * 0.1,
          selectedComplexity: AlgorithmicComplexityClass.O_N_SQUARED,
        },
      })),
    ];

    let truePositives = 0;
    let falsePositives = 0;

    for (const sample of cohort) {
      const pred = service.classifyPlacementMatch(sample.dto);
      if (pred.isSmurfFlagged && sample.isActualSmurf) truePositives++;
      if (pred.isSmurfFlagged && !sample.isActualSmurf) falsePositives++;
    }

    const precision = truePositives / Math.max(1, truePositives + falsePositives);
    expect(precision).toBeGreaterThanOrEqual(0.92);

    // Verify 3x Fast MMR Placement moves a flagged 1200-ELO smurf to Diamond (>= 2000 ELO) within 5 games
    const battlesService = new BattlesService({} as never, undefined, undefined, service);
    let rating = 1200;
    for (let game = 0; game < 5; game++) {
      const outcome = battlesService.calculateElo(
        rating,
        rating,
        128,
        128,
        FAST_MMR_PLACEMENT_MULTIPLIER,
      );
      rating = outcome.winnerRating;
    }
    expect(rating).toBeGreaterThanOrEqual(2000);
  });

  it('persists audit telemetry and constructive notification in Prisma without banning', async () => {
    const createAudit = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const createNotif = jest.fn().mockResolvedValue({ id: 'notif-1' });
    const mockPrisma = {
      smurfDetectionAudit: { create: createAudit },
      notification: { create: createNotif },
    } as never;

    const auditedService = new AntiSmurfService(mockPrisma);
    const res = await auditedService.evaluateAndRecordPlacement({
      battleId: 'battle-audit-99',
      userId: 'user-audit-99',
      timeToFirstSubmitSec: 30,
      typingSpeedWpm: 128,
      cyclomaticEfficiency: 0.94,
      firstAttemptPassRate: 1.0,
      selectedComplexity: AlgorithmicComplexityClass.O_LOG_N,
    });

    expect(res.isSmurfFlagged).toBe(true);
    expect(createAudit).toHaveBeenCalledTimes(1);
    expect(createNotif).toHaveBeenCalledTimes(1);
  });
});
