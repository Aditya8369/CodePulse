import { Test, TestingModule } from '@nestjs/testing';
import { ProfileHistoryService } from './profile-history.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Tier } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('ProfileHistoryService & Bi-Temporal Historical Data Versioning (#385)', () => {
  let service: ProfileHistoryService;
  let controller: UsersController;

  const mockUser = {
    id: 'user-uuid-101',
    username: 'octocat',
    name: 'Mona Lisa Octocat',
    email: 'octocat@github.com',
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation((args) => {
        if (args.where.id === mockUser.id || args.where.username === mockUser.username) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  };

  const mockUsersService = {
    getProfile: jest.fn().mockResolvedValue(mockUser),
    updateProfile: jest.fn().mockResolvedValue(mockUser),
    findByUsername: jest.fn().mockResolvedValue(mockUser),
  };

  const mockPrivacyService = {
    previewShred: jest.fn(),
    shredUserAccount: jest.fn(),
    getDeletionCertificate: jest.fn(),
    verifyCertificate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        ProfileHistoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrivacyService, useValue: mockPrivacyService },
      ],
    }).compile();

    service = module.get<ProfileHistoryService>(ProfileHistoryService);
    service.clearMemoryStore();
    controller = module.get<UsersController>(UsersController);
  });

  describe('1. Temporal Slice Creation & State Immobility', () => {
    it('should create initial bi-temporal developer profile slice with open-ended validTo', async () => {
      const slice1 = await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1200,
        tier: Tier.BRONZE,
        topLanguages: ['JavaScript', 'Python'],
        validFrom: '2026-01-01T00:00:00.000Z',
      });

      expect(slice1.id).toBeDefined();
      expect(slice1.userId).toBe(mockUser.id);
      expect(slice1.eloRating).toBe(1200);
      expect(slice1.tier).toBe(Tier.BRONZE);
      expect(slice1.topLanguages).toEqual(['JavaScript', 'Python']);
      expect(slice1.validFrom).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(slice1.validTo).toEqual(ProfileHistoryService.FAR_FUTURE);
      expect(slice1.isCurrent).toBe(true);
    });

    it('should atomically close the prior valid slice when recording a mutation', async () => {
      // 1. Initial slice: Jan 1, 2026
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1200,
        tier: Tier.BRONZE,
        topLanguages: ['JavaScript'],
        validFrom: '2026-01-01T00:00:00.000Z',
      });

      // 2. Second slice: March 1, 2026 (Elo rating jump to 1450, Tier SILVER)
      const slice2 = await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1450,
        tier: Tier.SILVER,
        topLanguages: ['JavaScript', 'TypeScript'],
        validFrom: '2026-03-01T00:00:00.000Z',
      });

      expect(slice2.validFrom).toEqual(new Date('2026-03-01T00:00:00.000Z'));
      expect(slice2.validTo).toEqual(ProfileHistoryService.FAR_FUTURE);
      expect(slice2.isCurrent).toBe(true);

      // Verify the previous slice was closed at March 1, 2026
      const janSnapshot = await service.getProfileAt(mockUser.id, '2026-02-01T00:00:00.000Z');
      expect(janSnapshot).not.toBeNull();
      expect(janSnapshot?.eloRating).toBe(1200);
      expect(janSnapshot?.tier).toBe(Tier.BRONZE);
      expect(janSnapshot?.validTo).toEqual(new Date('2026-03-01T00:00:00.000Z'));
      expect(janSnapshot?.isCurrent).toBe(false);
    });
  });

  describe('2. Time-Travel Queries (getProfileAt)', () => {
    beforeEach(async () => {
      // Build 3 consecutive chronological slices
      // Slice 1: Jan 1 -> March 1 (Bronze, 1200, Python)
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1200,
        tier: Tier.BRONZE,
        topLanguages: ['Python'],
        validFrom: '2026-01-01T00:00:00.000Z',
      });

      // Slice 2: March 1 -> June 1 (Silver, 1500, Python, Rust)
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1500,
        tier: Tier.SILVER,
        topLanguages: ['Python', 'Rust'],
        validFrom: '2026-03-01T00:00:00.000Z',
      });

      // Slice 3: June 1 -> Future (Gold, 1850, Rust, Go)
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1850,
        tier: Tier.GOLD,
        topLanguages: ['Rust', 'Go'],
        validFrom: '2026-06-01T00:00:00.000Z',
      });
    });

    it('should query exact developer state at tournament start date (Jan 15, 2026)', async () => {
      const start = performance.now();
      const snapshot = await service.getProfileAt(mockUser.id, '2026-01-15T12:00:00.000Z');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10); // Under 10ms SLA
      expect(snapshot).not.toBeNull();
      expect(snapshot?.eloRating).toBe(1200);
      expect(snapshot?.tier).toBe(Tier.BRONZE);
      expect(snapshot?.topLanguages).toEqual(['Python']);
    });

    it('should query exact developer state mid-season (April 20, 2026)', async () => {
      const snapshot = await service.getProfileAt(mockUser.id, '2026-04-20T00:00:00.000Z');

      expect(snapshot).not.toBeNull();
      expect(snapshot?.eloRating).toBe(1500);
      expect(snapshot?.tier).toBe(Tier.SILVER);
      expect(snapshot?.topLanguages).toEqual(['Python', 'Rust']);
    });

    it('should query current state at recent date (August 1, 2026)', async () => {
      const snapshot = await service.getProfileAt(mockUser.id, '2026-08-01T00:00:00.000Z');

      expect(snapshot).not.toBeNull();
      expect(snapshot?.eloRating).toBe(1850);
      expect(snapshot?.tier).toBe(Tier.GOLD);
      expect(snapshot?.topLanguages).toEqual(['Rust', 'Go']);
      expect(snapshot?.isCurrent).toBe(true);
    });

    it('should return null when querying before developer profile creation (2025-12-01)', async () => {
      const snapshot = await service.getProfileAt(mockUser.id, '2025-12-01T00:00:00.000Z');
      expect(snapshot).toBeNull();
    });

    it('should query by username cleanly', async () => {
      const snapshot = await service.getProfileAt('octocat', '2026-03-15T00:00:00.000Z');
      expect(snapshot).not.toBeNull();
      expect(snapshot?.tier).toBe(Tier.SILVER);
    });
  });

  describe('3. Bi-Temporal State Queries (Valid-Time & System-Time As-Of)', () => {
    it('should evaluate what the system knew at system-time T1 about valid-time V', async () => {
      const t1System = new Date('2026-01-01T10:00:00.000Z');
      const t2System = new Date('2026-01-05T10:00:00.000Z');

      // 1. Initial recording on Jan 1: Elo is 1200 for valid date Jan 1
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1200,
        tier: Tier.BRONZE,
        validFrom: '2026-01-01T00:00:00.000Z',
        recordedAt: '2026-01-01T10:00:00.000Z',
      });

      // Query as of Jan 2: returns 1200
      const queryAsOfJan2 = await service.getProfileBiTemporal(
        mockUser.id,
        '2026-01-02T00:00:00.000Z',
        '2026-01-02T12:00:00.000Z',
      );
      expect(queryAsOfJan2?.eloRating).toBe(1200);

      // Query before recordedAt: returns null (system did not know about it yet)
      const queryBeforeRecorded = await service.getProfileBiTemporal(
        mockUser.id,
        '2026-01-02T00:00:00.000Z',
        '2025-12-31T23:59:59.000Z',
      );
      expect(queryBeforeRecorded).toBeNull();
    });
  });

  describe('4. Timeline Sequence & Auditing', () => {
    it('should return ordered timeline sequence of all non-superseded slices', async () => {
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1200,
        tier: Tier.BRONZE,
        validFrom: '2026-01-01T00:00:00.000Z',
      });
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1400,
        tier: Tier.SILVER,
        validFrom: '2026-02-01T00:00:00.000Z',
      });
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1700,
        tier: Tier.GOLD,
        validFrom: '2026-03-01T00:00:00.000Z',
      });

      const timeline = await service.getTimeline(mockUser.id);
      expect(timeline.length).toBe(3);
      expect(timeline[0].eloRating).toBe(1200);
      expect(timeline[1].eloRating).toBe(1400);
      expect(timeline[2].eloRating).toBe(1700);
    });
  });

  describe('5. Exclusion Constraint Verification', () => {
    it('should execute PostgreSQL btree_gist extension and exclusion constraint DDL safely', async () => {
      const result = await service.ensureExclusionConstraint();
      expect(result).toBe(true);
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EXTENSION IF NOT EXISTS btree_gist;'),
      );
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('developer_profile_history_validity_excl'),
      );
    });
  });

  describe('6. Controller REST Endpoint (GET /api/v1/users/:username/history)', () => {
    beforeEach(async () => {
      await service.recordProfileMutation({
        userId: mockUser.id,
        eloRating: 1350,
        tier: Tier.SILVER,
        topLanguages: ['TypeScript'],
        validFrom: '2026-05-01T00:00:00.000Z',
      });
    });

    it('should return historical snapshot via GET :username/history?at=2026-06-01T00:00:00Z', async () => {
      const response = (await controller.getDeveloperProfileHistory('octocat', {
        at: '2026-06-01T00:00:00.000Z',
      })) as any;

      expect(response).toBeDefined();
      expect(response.eloRating).toBe(1350);
      expect(response.tier).toBe(Tier.SILVER);
      expect(response.topLanguages).toEqual(['TypeScript']);
    });

    it('should throw NotFoundException if no snapshot exists at requested historical date', async () => {
      await expect(
        controller.getDeveloperProfileHistory('octocat', {
          at: '2024-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return full timeline when timeline=true query parameter is supplied', async () => {
      const timeline = await controller.getDeveloperProfileHistory('octocat', {
        timeline: 'true',
      });

      expect(Array.isArray(timeline)).toBe(true);
      expect((timeline as any[]).length).toBeGreaterThanOrEqual(1);
    });
  });
});
