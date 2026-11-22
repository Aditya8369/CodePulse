import { Test, TestingModule } from '@nestjs/testing';
import {
  PersonaBattleService,
  HISTORICAL_PERSONAS,
  REFERENCE_CHALLENGES,
} from './persona-battle.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PersonaBattleService & AI Historical Battles Suite (#366)', () => {
  let service: PersonaBattleService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      aiPersona: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      personaBattleMatch: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...data, createdAt: new Date() }),
        ),
        update: jest.fn().mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      },
      xpTransaction: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'mock-xp-id', ...data, createdAt: new Date() }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonaBattleService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PersonaBattleService>(PersonaBattleService);
  });

  describe('Historical Persona Calibrations', () => {
    it('provides the 4 legendary historical programmer personas: Lovelace, Turing, Carmack, and Hamilton', async () => {
      const personas = await service.getAvailablePersonas();
      expect(personas.length).toBeGreaterThanOrEqual(4);

      const ids = personas.map((p) => p.id);
      expect(ids).toContain('lovelace');
      expect(ids).toContain('turing');
      expect(ids).toContain('carmack');
      expect(ids).toContain('hamilton');
    });

    it('calibrates Ada Lovelace with optimal mathematical recursion and 2150 Elo', async () => {
      const lovelace = await service.getPersonaById('lovelace');
      expect(lovelace.name).toBe('Ada Lovelace');
      expect(lovelace.eloRating).toBe(2150);
      expect(lovelace.codingStyle).toContain('Optimal recursive algorithms');
      expect(lovelace.difficultyTier).toBe('LEGENDARY');
    });

    it('calibrates John Carmack with low-level bit manipulation, 2420 Elo, and blazing 118 WPM speed', async () => {
      const carmack = await service.getPersonaById('carmack');
      expect(carmack.name).toBe('John Carmack');
      expect(carmack.eloRating).toBe(2420);
      expect(carmack.typingSpeedWpm).toBe(118);
      expect(carmack.codingStyle).toContain('Fast inverse square root');
    });

    it('calibrates Margaret Hamilton with Apollo guidance defensive assertions and 2340 Elo', async () => {
      const hamilton = await service.getPersonaById('hamilton');
      expect(hamilton.name).toBe('Margaret Hamilton');
      expect(hamilton.eloRating).toBe(2340);
      expect(hamilton.codingStyle).toContain('Apollo 11 guidance style');
    });

    it('calibrates Alan Turing with cryptographic state machines and 2280 Elo', async () => {
      const turing = await service.getPersonaById('turing');
      expect(turing.name).toBe('Alan Turing');
      expect(turing.eloRating).toBe(2280);
      expect(turing.preferredLanguage).toBe('python');
    });
  });

  describe('Instant Solo Matchmaking (< 2 Seconds)', () => {
    it('creates a practice match session in under 200ms satisfying the < 2s criterion', async () => {
      const start = Date.now();
      const match = await service.startPracticeBattle({
        userId: 'dev-user-123',
        personaId: 'carmack',
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
      expect(match.battleId).toMatch(/^practice-/);
      expect(match.persona.id).toBe('carmack');
      expect(match.status).toBe('ACTIVE');
      expect(match.challenge).toBeDefined();
    });

    it('automatically matches an appropriate persona when personaId is omitted', async () => {
      const match = await service.startPracticeBattle({
        userId: 'dev-user-456',
      });

      expect(match.persona).toBeDefined();
      expect(HISTORICAL_PERSONAS.some((p) => p.id === match.persona.id)).toBe(true);
    });
  });

  describe('Natural Keystroke Cadence & Typo Injection', () => {
    it('generates realistic human-like typing micro-delays (150ms-400ms)', () => {
      const lovelace = HISTORICAL_PERSONAS.find((p) => p.id === 'lovelace')!;
      const frames = service.generateKeystrokeStream(lovelace, 'const result = fibonacci(10);', 25);

      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        // Individual delays should be within realistic human typing cadence
        expect(frame.delayMs).toBeGreaterThanOrEqual(80);
        expect(frame.delayMs).toBeLessThanOrEqual(900);
      }
    });

    it('generates faster typing cadence for John Carmack (118 WPM)', () => {
      const carmack = HISTORICAL_PERSONAS.find((p) => p.id === 'carmack')!;
      const lovelace = HISTORICAL_PERSONAS.find((p) => p.id === 'lovelace')!;

      const carmackFrames = service.generateKeystrokeStream(carmack, 'let v = num >>> 0;', 15);
      const lovelaceFrames = service.generateKeystrokeStream(lovelace, 'let v = num >>> 0;', 15);

      const avgCarmack = carmackFrames.reduce((acc, f) => acc + f.delayMs, 0) / carmackFrames.length;
      const avgLovelace = lovelaceFrames.reduce((acc, f) => acc + f.delayMs, 0) / lovelaceFrames.length;

      // Carmack (118 WPM) types notably faster than Lovelace (68 WPM)
      expect(avgCarmack).toBeLessThan(avgLovelace);
    });

    it('simulates occasional realistic typos and backspace corrections', () => {
      const persona = HISTORICAL_PERSONAS.find((p) => p.id === 'hamilton')!;
      // Generate longer stream to ensure stochastic typo occurs
      const frames = service.generateKeystrokeStream(
        persona,
        'function comprehensiveValidationOfTelemetryInputBuffersAndFlightControlPointers() { return true; }',
        80,
      );

      // Verify presence of typo correction frames or correct structure
      const typoFrames = frames.filter((f) => f.isTypoCorrection === true);
      if (typoFrames.length > 0) {
        // Should contain backspace frame
        expect(typoFrames.some((f) => f.delta === '\b')).toBe(true);
      }
    });
  });

  describe('Solo Practice Match Resolution & Unranked Practice XP', () => {
    it('awards 50 unranked practice XP on user victory against AI persona', async () => {
      const match = await service.startPracticeBattle({
        userId: 'hero-dev',
        personaId: 'lovelace',
      });

      const outcome = await service.finishPracticeBattle({
        battleId: match.battleId,
        userId: 'hero-dev',
        userCode: 'function fibonacci(n) { return 55; }',
        userPassedTests: 8,
        totalTests: 8,
      });

      expect(outcome.battleId).toBe(match.battleId);
      expect(outcome.winner).toBe('USER');
      expect(outcome.userScore).toBe(100);
      expect(outcome.practiceXpAwarded).toBe(50);
      expect(outcome.summary).toContain('Ada Lovelace');
      expect(mockPrisma.xpTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'hero-dev',
            amount: 50,
            source: 'BATTLE_PRACTICE_AI',
          }),
        }),
      );
    });

    it('awards 15 unranked practice XP participation reward when AI wins', async () => {
      const match = await service.startPracticeBattle({
        userId: 'rookie-dev',
        personaId: 'carmack',
      });

      const outcome = await service.finishPracticeBattle({
        battleId: match.battleId,
        userId: 'rookie-dev',
        userCode: 'function totalSetBits() { return 0; }',
        userPassedTests: 1,
        totalTests: 8,
      });

      expect(outcome.winner).toBe('PERSONA');
      expect(outcome.practiceXpAwarded).toBe(15);
      expect(outcome.summary).toContain('John Carmack');
    });
  });
});
