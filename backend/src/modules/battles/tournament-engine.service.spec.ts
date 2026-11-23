import { TournamentEngineService } from './tournament-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TournamentFormat,
  TournamentMatchStatus,
  TournamentStatus,
} from './dto/tournament.dto';

describe('TournamentEngineService (#535)', () => {
  let service: TournamentEngineService;
  let mockPrisma: any;
  let mockQueue: any;

  beforeEach(() => {
    mockPrisma = {
      battleRating: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };
    service = new TournamentEngineService(
      mockPrisma as unknown as PrismaService,
      mockQueue,
    );
  });

  describe('64-Player Swiss Pairing Performance (<200ms)', () => {
    it('automatically pairs a 64-player Swiss round in under 200ms without rematches', async () => {
      const participants = Array.from({ length: 64 }, (_, i) => ({
        userId: `user_p${i + 1}`,
        username: `Player_${i + 1}`,
        seed: i + 1,
        elo: 1000 + Math.floor(Math.random() * 800),
      }));

      const tournament = await service.createTournament({
        name: 'Grand Masters 64 Swiss Championship',
        format: TournamentFormat.SWISS,
        totalRounds: 6,
        participants,
      });

      const start = performance.now();
      const matches = service.generateSwissRound(tournament, 1);
      const durationMs = performance.now() - start;

      expect(matches.length).toBe(32); // 64 players = 32 pairings
      expect(durationMs).toBeLessThan(200); // Strict acceptance criteria: under 200ms

      // Verify each player is paired exactly once
      const pairedPlayers = new Set<string>();
      for (const m of matches) {
        expect(pairedPlayers.has(m.player1Id)).toBe(false);
        expect(pairedPlayers.has(m.player2Id!)).toBe(false);
        pairedPlayers.add(m.player1Id);
        pairedPlayers.add(m.player2Id!);
      }
      expect(pairedPlayers.size).toBe(64);
    });

    it('handles odd number of participants by allocating a BYE to the lowest seeded player', async () => {
      const participants = Array.from({ length: 7 }, (_, i) => ({
        userId: `user_odd_${i + 1}`,
        username: `OddPlayer_${i + 1}`,
        seed: i + 1,
        elo: 1200,
      }));

      const tournament = await service.createTournament({
        name: 'Odd Swiss Cup',
        format: TournamentFormat.SWISS,
        totalRounds: 3,
        participants,
      });

      const matches = service.generateSwissRound(tournament, 1);
      expect(matches.length).toBe(4); // 3 player matches + 1 BYE match

      const byeMatch = matches.find((m) => m.isBye);
      expect(byeMatch).toBeDefined();
      expect(byeMatch?.status).toBe(TournamentMatchStatus.BYE);
      expect(byeMatch?.player1Id).toBe('user_odd_7'); // lowest rank player gets BYE
      expect(byeMatch?.winnerId).toBe('user_odd_7');

      const byePlayer = tournament.participants.get('user_odd_7');
      expect(byePlayer?.score).toBe(1.0);
      expect(byePlayer?.hasReceivedBye).toBe(true);
    });
  });

  describe('Buchholz Tiebreaker Score Calculation (FIDE / Esports Standard)', () => {
    it('accurately calculates Buchholz tiebreaker scores as sum of opponents scores', async () => {
      const tournament = await service.createTournament({
        name: 'Tiebreaker Invitational',
        format: TournamentFormat.SWISS,
        participants: [
          { userId: 'u1', username: 'Alpha' },
          { userId: 'u2', username: 'Beta' },
          { userId: 'u3', username: 'Gamma' },
          { userId: 'u4', username: 'Delta' },
        ],
      });

      // Mock match history:
      // u1 played against u2 (u2 has 2 points) and u3 (u3 has 1 point)
      // Therefore u1's Buchholz score must be 2 + 1 = 3.0
      const p1 = tournament.participants.get('u1')!;
      const p2 = tournament.participants.get('u2')!;
      const p3 = tournament.participants.get('u3')!;
      const p4 = tournament.participants.get('u4')!;

      p1.score = 2.0;
      p2.score = 2.0;
      p3.score = 1.0;
      p4.score = 0.0;

      p1.opponentsPlayed = ['u2', 'u3'];
      p2.opponentsPlayed = ['u1', 'u4'];

      service.calculateBuchholzScores(tournament);

      expect(p1.buchholzScore).toBe(3.0); // 2.0 (u2) + 1.0 (u3)
      expect(p2.buchholzScore).toBe(2.0); // 2.0 (u1) + 0.0 (u4)
    });
  });

  describe('Forfeit & Disconnect Handling Without Bracket Stall', () => {
    it('processes forfeit gracefully and awards win to opponent without stalling', async () => {
      const tournament = await service.createTournament({
        name: 'Forfeit Test Open',
        format: TournamentFormat.SINGLE_ELIMINATION,
        participants: [
          { userId: 'p1', username: 'Player1' },
          { userId: 'p2', username: 'Player2' },
        ],
      });

      await service.startTournament(tournament.id);
      const match = tournament.matches[0];

      const result = await service.forfeitMatch(tournament.id, match.id, {
        forfeitedByUserId: 'p1',
        reason: 'Network disconnect',
      });

      expect(result.match.status).toBe(TournamentMatchStatus.FORFEITED);
      expect(result.match.winnerId).toBe('p2');
      expect(result.match.notes).toBe('Network disconnect');

      const p2 = tournament.participants.get('p2')!;
      expect(p2.score).toBe(1.0);
    });
  });

  describe('Competitive ELO Rating Updates', () => {
    it('calculates proper ELO adjustments and updates battle ratings', () => {
      // 1200 vs 1200: Winner should gain +16, Loser -16 with K=32
      const { deltaA, deltaB } = service.calculateEloDeltas(1200, 1200, 1.0);
      expect(deltaA).toBe(16);
      expect(deltaB).toBe(-16);
    });

    it('calculates draw ELO deltas when ratings are equal', () => {
      const { deltaA, deltaB } = service.calculateEloDeltas(1200, 1200, 0.5);
      expect(deltaA).toBe(0);
      expect(deltaB).toBe(0);
    });
  });

  describe('Visual Bracket Tree Query (/api/v1/tournaments/:id/brackets)', () => {
    it('returns structured rounds and sorted ranked standings with Buchholz', async () => {
      const tournament = await service.createTournament({
        name: 'Visual Tree Cup',
        format: TournamentFormat.SWISS,
        participants: [
          { userId: 'u1', username: 'Alice', elo: 1500 },
          { userId: 'u2', username: 'Bob', elo: 1400 },
        ],
      });

      await service.startTournament(tournament.id);
      const bracketTree = service.getBracketTree(tournament.id);

      expect(bracketTree.tournamentId).toBe(tournament.id);
      expect(bracketTree.rounds.length).toBe(1);
      expect(bracketTree.rounds[0].matches.length).toBe(1);
      expect(bracketTree.standings.length).toBe(2);
      expect(bracketTree.standings[0].rank).toBe(1);
      expect(bracketTree.standings[1].rank).toBe(2);
    });
  });

  describe('100 Simulated Tournament Scenarios (Acceptance Criteria)', () => {
    it('simulates 100 complete tournament runs across formats with zero errors or rematches', async () => {
      for (let sim = 0; sim < 100; sim++) {
        const playerCount = 4; // Fast simulated 4-player Swiss / Single-elim
        const format =
          sim % 2 === 0
            ? TournamentFormat.SWISS
            : TournamentFormat.SINGLE_ELIMINATION;

        const participants = Array.from({ length: playerCount }, (_, i) => ({
          userId: `sim_${sim}_p${i}`,
          username: `SimUser_${i}`,
          seed: i + 1,
          elo: 1100 + i * 50,
        }));

        const tournament = await service.createTournament({
          name: `Simulated Tournament #${sim + 1}`,
          format,
          totalRounds: 2,
          participants,
        });

        await service.startTournament(tournament.id);

        // Play Round 1 matches
        const r1Matches = tournament.matches.filter((m) => m.round === 1);
        for (const m of r1Matches) {
          if (!m.isBye) {
            await service.reportMatchResult(tournament.id, m.id, {
              winnerId: m.player1Id,
            });
          }
        }

        // If Round 2 was generated, play Round 2 matches
        const r2Matches = tournament.matches.filter((m) => m.round === 2);
        for (const m of r2Matches) {
          if (!m.isBye) {
            await service.reportMatchResult(tournament.id, m.id, {
              winnerId: m.player1Id,
            });
          }
        }

        // Validate tournament state integrity
        expect(tournament.matches.length).toBeGreaterThan(0);
        const bracket = service.getBracketTree(tournament.id);
        expect(bracket.standings.length).toBe(playerCount);

        // Verify no duplicate opponent matchups in Swiss
        if (format === TournamentFormat.SWISS) {
          for (const p of tournament.participants.values()) {
            const uniqueOpps = new Set(p.opponentsPlayed);
            expect(uniqueOpps.size).toBe(p.opponentsPlayed.length);
          }
        }
      }
    });
  });

  describe('Double-Elimination Bracket Advancement Engine (#1088)', () => {
    it('simulates a 64-player double-elimination tournament to completion with zero orphaned matches', async () => {
      const participants = Array.from({ length: 64 }, (_, i) => ({
        userId: `player_de_${i + 1}`,
        username: `DE_Pro_${i + 1}`,
        seed: i + 1,
        elo: 1500 - i * 5,
      }));

      const tournament = await service.createTournament({
        name: 'Nexus 64 Double Elimination Championship',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      await service.startTournament(tournament.id);

      const simResult = await service.simulateDoubleEliminationTournament(tournament.id, false);

      expect(simResult.tournament.status).toBe(TournamentStatus.COMPLETED);
      expect(simResult.totalMatches).toBeGreaterThan(60);
      expect(simResult.championId).toBeDefined();
      expect(simResult.championId.length).toBeGreaterThan(0);

      // Verify zero orphaned matches: every match must either be completed, bye, or forfeited
      const uncompletedMatches = simResult.tournament.matches.filter(
        (m) => m.status === TournamentMatchStatus.PENDING || m.status === TournamentMatchStatus.IN_PROGRESS,
      );
      expect(uncompletedMatches.length).toBe(0);
    });

    it('handles odd participant counts (50 players) with automatic seed-weighted BYEs', async () => {
      const participants = Array.from({ length: 50 }, (_, i) => ({
        userId: `odd_de_${i + 1}`,
        username: `OddPlayer_${i + 1}`,
        seed: i + 1,
        elo: 1400,
      }));

      const tournament = await service.createTournament({
        name: '50-Player Odd DE Cup',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      await service.startTournament(tournament.id);

      // Power of 2 padding for 50 is 64; num matches in R1 = 32
      const r1Matches = tournament.matches.filter((m) => m.round === 1);
      expect(r1Matches.length).toBe(32);

      // 14 players should receive automatic BYEs (64 - 50 = 14)
      const byeMatches = r1Matches.filter((m) => m.isBye);
      expect(byeMatches.length).toBe(14);

      // Seed 1 through 14 should have received BYEs
      for (let s = 1; s <= 14; s++) {
        const p = tournament.participants.get(`odd_de_${s}`);
        expect(p?.hasReceivedBye).toBe(true);
      }

      // Simulate to completion
      const sim = await service.simulateDoubleEliminationTournament(tournament.id);
      expect(sim.tournament.status).toBe(TournamentStatus.COMPLETED);
    });

    it('triggers and resolves Grand Finals Bracket Reset when loser bracket champion wins Set 1', async () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        userId: `reset_player_${i + 1}`,
        username: `ResetPro_${i + 1}`,
        seed: i + 1,
      }));

      const tournament = await service.createTournament({
        name: 'Bracket Reset Invitational',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      await service.startTournament(tournament.id);

      // Force Grand Finals Reset where loser bracket champion wins set 1
      const sim = await service.simulateDoubleEliminationTournament(tournament.id, true);

      expect(sim.resetOccurred).toBe(true);
      expect(sim.tournament.status).toBe(TournamentStatus.COMPLETED);

      const finalsMatches = sim.tournament.matches.filter((m) => m.bracketType === 'FINALS');
      expect(finalsMatches.length).toBe(2); // Set 1 + Set 2 (Bracket Reset)
      expect(finalsMatches[1].notes).toContain('Grand Finals Bracket Reset');
    });
  });
});
