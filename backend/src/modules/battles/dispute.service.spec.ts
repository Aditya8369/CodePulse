import { Test, TestingModule } from '@nestjs/testing';
import { BattleDisputeService } from './dispute.service';

describe('BattleDisputeService (#1093)', () => {
  let service: BattleDisputeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BattleDisputeService],
    }).compile();

    service = module.get<BattleDisputeService>(BattleDisputeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Filing Dispute & Deterministic Snapshot Capture', () => {
    it('freezes match outcome, halts ELO payouts, and captures forensic snapshot', async () => {
      const dispute = await service.fileDispute({
        battleId: 'match-finals-404',
        filerId: 'player-alice',
        accusedId: 'player-bot-bob',
        reason: 'Suspected external LLM bot usage and instant code paste',
        finalCodeState: 'a'.repeat(600), // triggers high anomaly score
      });

      expect(dispute.id).toBeDefined();
      expect(dispute.status).toBe('PENDING');
      expect(dispute.snapshot.isEloPayoutFrozen).toBe(true);
      expect(dispute.snapshot.biometricWpmAnomalyScore).toBeGreaterThan(0.9);
      expect(dispute.snapshot.keystrokeTimeline.length).toBeGreaterThan(0);
    });
  });

  describe('Moderator Live Adjudication & Voting Panel', () => {
    it('records moderator votes and transitions status to UNDER_REVIEW', async () => {
      const dispute = await service.fileDispute({
        battleId: 'match-finals-405',
        filerId: 'player-alice',
        accusedId: 'player-cheater',
        reason: 'Tab blur and copy paste',
      });

      const updated = service.submitModeratorVote(dispute.id, {
        moderatorId: 'mod-chief',
        verdict: 'OVERTURN_MATCH_REVERSE_ELO',
        votedAt: new Date(),
        notes: 'Forensic keystroke timeline reveals impossible typing speed',
      });

      expect(updated.status).toBe('UNDER_REVIEW');
      expect(updated.snapshot.moderatorVotes.length).toBe(1);
      expect(updated.snapshot.moderatorVotes[0].moderatorId).toBe('mod-chief');
    });
  });

  describe('Overturn Ruling & Atomic ELO Reversal (Acceptance Criteria)', () => {
    it('moderator ruling overturns match and reverses ELO transactions atomically', async () => {
      const dispute = await service.fileDispute({
        battleId: 'match-finals-406',
        filerId: 'victim-pro',
        accusedId: 'cheater-bot',
        reason: 'Proved plagiarism from GitHub solution',
      });

      const ruling = await service.adjudicateRuling(
        dispute.id,
        'admin-head',
        'OVERTURN_MATCH_REVERSE_ELO',
        'Overturned after multi-moderator review',
      );

      expect(ruling.eloReversed).toBe(true);
      expect(ruling.winnerAfterRuling).toBe('victim-pro');
      expect(ruling.dispute.status).toBe('RESOLVED');
      expect(ruling.dispute.eloReversed).toBe(true);
      expect(ruling.dispute.snapshot.isEloPayoutFrozen).toBe(false);
    });

    it('affirms ruling when dispute lacks evidence', async () => {
      const dispute = await service.fileDispute({
        battleId: 'match-finals-407',
        filerId: 'player-salty',
        accusedId: 'fair-winner',
        reason: 'Lost match',
      });

      const ruling = await service.adjudicateRuling(
        dispute.id,
        'admin-head',
        'AFFIRM_ORIGINAL_RULING',
      );

      expect(ruling.eloReversed).toBe(false);
      expect(ruling.winnerAfterRuling).toBe('fair-winner');
      expect(ruling.dispute.status).toBe('RESOLVED');
    });
  });
});
