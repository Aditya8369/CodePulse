import { Test, TestingModule } from '@nestjs/testing';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TournamentFormat,
  TournamentMatchStatus,
  TournamentStatus,
} from './dto/tournament.dto';

describe('TournamentService & Double-Elimination Bracket Engine (#400)', () => {
  let service: TournamentService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      tournament: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      tournamentParticipant: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      tournamentMatch: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TournamentService>(TournamentService);
  });

  describe('Power-of-Two Capacity Calculation & Elo Seeding', () => {
    it('calculates nearest power-of-two capacity (8, 16, 32, 64) for participant counts', () => {
      expect(service.calculatePowerOfTwoCapacity(3)).toBe(4);
      expect(service.calculatePowerOfTwoCapacity(7)).toBe(8);
      expect(service.calculatePowerOfTwoCapacity(8)).toBe(8);
      expect(service.calculatePowerOfTwoCapacity(13)).toBe(16);
      expect(service.calculatePowerOfTwoCapacity(16)).toBe(16);
      expect(service.calculatePowerOfTwoCapacity(25)).toBe(32);
      expect(service.calculatePowerOfTwoCapacity(32)).toBe(32);
      expect(service.calculatePowerOfTwoCapacity(48)).toBe(64);
    });

    it('seeds participants by competitive Elo rating descending so top seeds do not collide in early rounds', () => {
      const participants = [
        { userId: 'u3', username: 'P3', elo: 1400 },
        { userId: 'u1', username: 'P1', elo: 2100 },
        { userId: 'u4', username: 'P4', elo: 1200 },
        { userId: 'u2', username: 'P2', elo: 1850 },
      ];

      const seeded = service.seedParticipantsByElo(participants, 4);
      expect(seeded[0].userId).toBe('u1'); // 2100 -> Seed 1
      expect(seeded[0].seedNumber).toBe(1);
      expect(seeded[1].userId).toBe('u2'); // 1850 -> Seed 2
      expect(seeded[1].seedNumber).toBe(2);
      expect(seeded[2].userId).toBe('u3'); // 1400 -> Seed 3
      expect(seeded[2].seedNumber).toBe(3);
      expect(seeded[3].userId).toBe('u4'); // 1200 -> Seed 4
      expect(seeded[3].seedNumber).toBe(4);
    });

    it('generates standard recursive fold seed orders for 8, 16, and 32 players', () => {
      // 8 players: [1, 8, 4, 5, 2, 7, 3, 6]
      const order8 = service.generateSeedOrder(8);
      expect(order8).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);

      // 16 players: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
      const order16 = service.generateSeedOrder(16);
      expect(order16).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);

      // Verify in Round 1: sum of each pair is capacity + 1
      for (let i = 0; i < order16.length; i += 2) {
        expect(order16[i] + order16[i + 1]).toBe(17);
      }
    });
  });

  describe('Automated Bye Allocation (Odd & Non-Power-of-Two Participants)', () => {
    it('automatically allocates a BYE to Seed 1 in a 7-player tournament and advances them immediately', async () => {
      const participants = Array.from({ length: 7 }, (_, i) => ({
        userId: `p_${i + 1}`,
        username: `Player_${i + 1}`,
        elo: 2000 - i * 100, // p_1 is Seed 1, p_7 is Seed 7
      }));

      const bracket = await service.createTournament({
        title: '7-Player Double Elimination Open',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      expect(bracket.bracketCapacity).toBe(8);
      expect(bracket.participantCount).toBe(7);

      // In Round 1, Seed 1 plays against Seed 8 (which is a BYE)
      const wR1 = bracket.winnersBracket.find((r) => r.round === 1)!;
      const byeMatch = wR1.matches.find((m) => m.isBye);

      expect(byeMatch).toBeDefined();
      expect(byeMatch?.status).toBe(TournamentMatchStatus.COMPLETED);
      expect(byeMatch?.winnerId).toBe('p_1');

      // Seed 1 is immediately advanced to Round 2 without waiting
      const wR2 = bracket.winnersBracket.find((r) => r.round === 2)!;
      expect(wR2.matches.some((m) => m.player1Id === 'p_1' || m.player2Id === 'p_1')).toBe(true);
    });

    it('allocates 3 BYEs to top 3 seeds in a 13-player tournament (16-capacity bracket)', async () => {
      const participants = Array.from({ length: 13 }, (_, i) => ({
        userId: `p_${i + 1}`,
        username: `Player_${i + 1}`,
        elo: 2200 - i * 50,
      }));

      const bracket = await service.createTournament({
        title: '13-Player Cup',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      expect(bracket.bracketCapacity).toBe(16);
      const wR1 = bracket.winnersBracket.find((r) => r.round === 1)!;
      const byeMatches = wR1.matches.filter((m) => m.isBye);

      expect(byeMatches).toHaveLength(3);
      // Top 3 seeds (p_1, p_2, p_3) are auto-advanced
      const advancedWinners = byeMatches.map((m) => m.winnerId);
      expect(advancedWinners).toContain('p_1');
      expect(advancedWinners).toContain('p_2');
      expect(advancedWinners).toContain('p_3');
    });
  });

  describe('8-Player Double Elimination Bracket Progression', () => {
    it('executes complete 8-player double elimination bracket progression without deadlocks', async () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        userId: `player_${i + 1}`,
        username: `Contender_${i + 1}`,
        elo: 2000 - i * 100,
      }));

      const initialBracket = await service.createTournament({
        title: 'Apex 8 Double Elimination Invitational',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      const tId = initialBracket.tournamentId;
      expect(initialBracket.winnersBracket).toHaveLength(3); // 3 Winners rounds (Quarter, Semi, Final)
      expect(initialBracket.losersBracket).toHaveLength(4);  // 4 Losers rounds
      expect(initialBracket.grandFinals).toBeDefined();

      // ==========================================
      // Winners Round 1 (4 matches)
      // ==========================================
      let view = initialBracket;
      const wR1 = view.winnersBracket.find((r) => r.round === 1)!;

      // P1 beats P8, P4 beats P5, P2 beats P7, P3 beats P6
      view = await service.advanceMatch(tId, wR1.matches[0].id, { winnerId: 'player_1' });
      view = await service.advanceMatch(tId, wR1.matches[1].id, { winnerId: 'player_4' });
      view = await service.advanceMatch(tId, wR1.matches[2].id, { winnerId: 'player_2' });
      view = await service.advanceMatch(tId, wR1.matches[3].id, { winnerId: 'player_3' });

      // Verify Winners Round 2 is populated with winners
      const wR2 = view.winnersBracket.find((r) => r.round === 2)!;
      expect(wR2.matches[0].player1Id).toBe('player_1');
      expect(wR2.matches[0].player2Id).toBe('player_4');
      expect(wR2.matches[1].player1Id).toBe('player_2');
      expect(wR2.matches[1].player2Id).toBe('player_3');

      // Verify Losers Round 1 is populated with losers (player_8, player_5, player_7, player_6)
      const lR1 = view.losersBracket.find((r) => r.round === 1)!;
      expect(lR1.matches[0].player1Id).toBe('player_8');
      expect(lR1.matches[0].player2Id).toBe('player_5');
      expect(lR1.matches[1].player1Id).toBe('player_7');
      expect(lR1.matches[1].player2Id).toBe('player_6');

      // ==========================================
      // Winners Round 2 (Semifinals)
      // ==========================================
      view = await service.advanceMatch(tId, wR2.matches[0].id, { winnerId: 'player_1' }); // player_4 drops to Losers R2
      view = await service.advanceMatch(tId, wR2.matches[1].id, { winnerId: 'player_2' }); // player_3 drops to Losers R2

      // Verify Winners Final (W3) has player_1 vs player_2
      const wR3 = view.winnersBracket.find((r) => r.round === 3)!;
      expect(wR3.matches[0].player1Id).toBe('player_1');
      expect(wR3.matches[0].player2Id).toBe('player_2');

      // ==========================================
      // Losers Round 1 (2 matches)
      // ==========================================
      view = await service.advanceMatch(tId, lR1.matches[0].id, { winnerId: 'player_5' });
      view = await service.advanceMatch(tId, lR1.matches[1].id, { winnerId: 'player_6' });

      // ==========================================
      // Losers Round 2 (2 matches: L1 winners vs W2 losers)
      // ==========================================
      const lR2 = view.losersBracket.find((r) => r.round === 2)!;
      view = await service.advanceMatch(tId, lR2.matches[0].id, { winnerId: 'player_4' });
      view = await service.advanceMatch(tId, lR2.matches[1].id, { winnerId: 'player_3' });

      // ==========================================
      // Losers Round 3 (Losers Semifinal)
      // ==========================================
      const lR3 = view.losersBracket.find((r) => r.round === 3)!;
      view = await service.advanceMatch(tId, lR3.matches[0].id, { winnerId: 'player_3' });

      // ==========================================
      // Winners Final: player_1 beats player_2
      // ==========================================
      view = await service.advanceMatch(tId, wR3.matches[0].id, { winnerId: 'player_1' });
      // player_2 drops to Losers Final

      // ==========================================
      // Losers Final (L4): player_2 vs player_3
      // ==========================================
      const lR4 = view.losersBracket.find((r) => r.round === 4)!;
      expect(lR4.matches[0].player1Id).toBe('player_3');
      expect(lR4.matches[0].player2Id).toBe('player_2');

      view = await service.advanceMatch(tId, lR4.matches[0].id, { winnerId: 'player_2' });

      // ==========================================
      // Grand Finals: player_1 (Winners champion) vs player_2 (Losers champion)
      // ==========================================
      const gf = view.grandFinals!;
      expect(gf.player1Id).toBe('player_1');
      expect(gf.player2Id).toBe('player_2');

      view = await service.advanceMatch(tId, gf.id, { winnerId: 'player_1' });

      // Tournament successfully completed!
      expect(view.status).toBe(TournamentStatus.COMPLETED);
      expect(view.standings[0].userId).toBe('player_1');
      expect(view.standings[0].bracket).toBe('CHAMPION');
      expect(view.standings[0].rank).toBe(1);
    });
  });

  describe('16-Player and 32-Player Bracket Scaling', () => {
    it('generates mathematically correct 16-player Double Elimination bracket with 30 total matches', async () => {
      const participants = Array.from({ length: 16 }, (_, i) => ({
        userId: `p_${i + 1}`,
        username: `Player_${i + 1}`,
        elo: 2000 - i * 50,
      }));

      const bracket = await service.createTournament({
        title: 'Collegiate 16 Championship',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      expect(bracket.bracketCapacity).toBe(16);
      expect(bracket.winnersBracket).toHaveLength(4); // 4 rounds (8, 4, 2, 1) = 15 matches
      expect(bracket.losersBracket).toHaveLength(6);  // 6 rounds (4, 4, 2, 2, 1, 1) = 14 matches
      expect(bracket.grandFinals).toBeDefined();      // 1 match

      // Total matches in 16-player double elimination = 15 + 14 + 1 = 30 matches
      let totalMatches = 0;
      bracket.winnersBracket.forEach((r) => (totalMatches += r.matches.length));
      bracket.losersBracket.forEach((r) => (totalMatches += r.matches.length));
      if (bracket.grandFinals) totalMatches += 1;

      expect(totalMatches).toBe(30);
    });

    it('generates mathematically correct 32-player Double Elimination bracket with 62 total matches', async () => {
      const participants = Array.from({ length: 32 }, (_, i) => ({
        userId: `p_${i + 1}`,
        username: `Player_${i + 1}`,
        elo: 2500 - i * 30,
      }));

      const bracket = await service.createTournament({
        title: 'Global 32 Masters',
        format: TournamentFormat.DOUBLE_ELIMINATION,
        participants,
      });

      expect(bracket.bracketCapacity).toBe(32);
      expect(bracket.winnersBracket).toHaveLength(5); // 5 rounds (16, 8, 4, 2, 1) = 31 matches
      expect(bracket.losersBracket).toHaveLength(8);  // 8 rounds = 30 matches
      expect(bracket.grandFinals).toBeDefined();      // 1 match

      // Total matches in 32-player double elimination = 31 + 30 + 1 = 62 matches
      let totalMatches = 0;
      bracket.winnersBracket.forEach((r) => (totalMatches += r.matches.length));
      bracket.losersBracket.forEach((r) => (totalMatches += r.matches.length));
      if (bracket.grandFinals) totalMatches += 1;

      expect(totalMatches).toBe(62);

      // Verify Round 1 match 1 is Seed 1 vs Seed 32
      const wR1 = bracket.winnersBracket[0];
      expect(wR1.matches[0].player1Id).toBe('p_1');
      expect(wR1.matches[0].player2Id).toBe('p_32');
    });

    it('generates Single Elimination 8-player bracket and crowns champion in 7 matches', async () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        userId: `p_${i + 1}`,
        username: `P_${i + 1}`,
        elo: 1800 - i * 50,
      }));

      let view = await service.createTournament({
        title: 'Single Elimination 8 Cup',
        format: TournamentFormat.SINGLE_ELIMINATION,
        participants,
      });

      expect(view.winnersBracket).toHaveLength(3); // Quarter, Semi, Final = 7 matches
      expect(view.losersBracket).toHaveLength(0);

      const tId = view.tournamentId;

      // Advance Quarterfinals
      const r1 = view.winnersBracket[0];
      view = await service.advanceMatch(tId, r1.matches[0].id, { winnerId: 'p_1' });
      view = await service.advanceMatch(tId, r1.matches[1].id, { winnerId: 'p_4' });
      view = await service.advanceMatch(tId, r1.matches[2].id, { winnerId: 'p_2' });
      view = await service.advanceMatch(tId, r1.matches[3].id, { winnerId: 'p_3' });

      // Advance Semifinals
      const r2 = view.winnersBracket[1];
      view = await service.advanceMatch(tId, r2.matches[0].id, { winnerId: 'p_1' });
      view = await service.advanceMatch(tId, r2.matches[1].id, { winnerId: 'p_2' });

      // Advance Final
      const r3 = view.winnersBracket[2];
      view = await service.advanceMatch(tId, r3.matches[0].id, { winnerId: 'p_1' });

      expect(view.status).toBe(TournamentStatus.COMPLETED);
      expect(view.standings[0].userId).toBe('p_1');
      expect(view.standings[0].bracket).toBe('CHAMPION');
    });
  });
});

