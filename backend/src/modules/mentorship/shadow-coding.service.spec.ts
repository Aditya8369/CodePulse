import { Test, TestingModule } from '@nestjs/testing';
import { ShadowCodingService } from './shadow-coding.service';
import { MentorshipController } from './mentorship.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('ShadowCodingService & MentorshipController', () => {
  let service: ShadowCodingService;
  let controller: MentorshipController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      mentorshipProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      shadowCodingSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MentorshipController],
      providers: [
        ShadowCodingService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ShadowCodingService>(ShadowCodingService);
    controller = module.get<MentorshipController>(MentorshipController);
  });

  describe('Mentor-Apprentice Pairing Engine', () => {
    it('ranks mentors according to target skills, timezone and experience', async () => {
      prismaMock.mentorshipProfile.findMany.mockResolvedValueOnce([
        {
          userId: 'mentor-1',
          timezone: 'America/New_York',
          skills: ['Rust', 'Distributed Systems'],
          completedSessions: 25,
          isCertifiedMentor: true,
          user: { username: 'rustacean', name: 'Rust Expert', bio: 'Senior SRE' },
        },
        {
          userId: 'mentor-2',
          timezone: 'UTC',
          skills: ['TypeScript', 'React'],
          completedSessions: 8,
          isCertifiedMentor: false,
          user: { username: 'fe_guru', name: 'Frontend Lead', bio: 'Staff Engineer' },
        },
      ]);

      const mentors = await service.findCompatibleMentors({
        skill: 'Rust',
        timezone: 'America/New_York',
      });

      expect(mentors.length).toBe(2);
      expect(mentors[0].mentorId).toBe('mentor-1');
      expect(mentors[0].matchScore).toBeGreaterThan(mentors[1].matchScore);
    });
  });

  describe('Shadow Session Creation & Participants', () => {
    it('creates a new shadow session with mentor in the driver seat', async () => {
      prismaMock.shadowCodingSession.create.mockResolvedValueOnce({
        id: 'session-101',
        mentorId: 'mentor-1',
        apprenticeId: 'apprentice-1',
        title: 'Building a custom RocksDB engine',
        driverSeat: 'MENTOR',
        status: 'ACTIVE',
      });

      const session = await service.createSession('apprentice-1', {
        mentorId: 'mentor-1',
        title: 'Building a custom RocksDB engine',
      });

      expect(session.id).toBe('session-101');
      expect(session.driverSeat).toBe('MENTOR');
      expect(session.status).toBe('ACTIVE');
    });

    it('prevents self-pairing sessions', async () => {
      await expect(
        service.createSession('user-1', {
          mentorId: 'user-1',
          title: 'Solo session',
        }),
      ).rejects.toThrow();
    });
  });

  describe('One-Click Driver Handover', () => {
    it('switches driver seat control from MENTOR to APPRENTICE', async () => {
      prismaMock.shadowCodingSession.findUnique.mockResolvedValueOnce({
        id: 'session-101',
        mentorId: 'mentor-1',
        apprenticeId: 'apprentice-1',
        driverSeat: 'MENTOR',
      });

      prismaMock.shadowCodingSession.update.mockResolvedValueOnce({
        id: 'session-101',
        driverSeat: 'APPRENTICE',
      });

      const updated = await service.handoverDriverSeat('session-101', 'mentor-1', {
        driverSeat: 'APPRENTICE',
      });

      expect(updated.driverSeat).toBe('APPRENTICE');
      expect(prismaMock.shadowCodingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { driverSeat: 'APPRENTICE' },
        }),
      );
    });

    it('rejects driver seat transfer from unauthorized outsiders', async () => {
      prismaMock.shadowCodingSession.findUnique.mockResolvedValueOnce({
        id: 'session-101',
        mentorId: 'mentor-1',
        apprenticeId: 'apprentice-1',
      });

      await expect(
        service.handoverDriverSeat('session-101', 'stranger-danger', {
          driverSeat: 'APPRENTICE',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Live Viewport & Cursor Synchronization (< 20ms lag)', () => {
    it('synchronizes editor viewport and cursor line/column within 20ms', async () => {
      prismaMock.shadowCodingSession.update.mockResolvedValueOnce({
        id: 'session-101',
        activeFile: 'engine.ts',
        activeLine: 42,
        activeColumn: 12,
        viewportTopLine: 35,
      });

      const event = await service.syncViewport('session-101', 'mentor-1', {
        activeFile: 'engine.ts',
        activeLine: 42,
        activeColumn: 12,
        viewportTopLine: 35,
        scratchpadNotes: 'Remember to acquire lock before buffer allocation',
      });

      expect(event.activeFile).toBe('engine.ts');
      expect(event.activeLine).toBe(42);
      expect(event.activeColumn).toBe(12);
      expect(event.latencyMs).toBeLessThanOrEqual(20); // Under 20ms requirement
    });
  });

  describe('Session Completion & Certified Mentor Badge Milestone (20 Sessions)', () => {
    it('increments total hours and awards Certified Mentor badge at 20 sessions', async () => {
      prismaMock.shadowCodingSession.findUnique.mockResolvedValueOnce({
        id: 'session-101',
        mentorId: 'mentor-1',
        apprenticeId: 'apprentice-1',
      });

      prismaMock.shadowCodingSession.update.mockResolvedValueOnce({
        id: 'session-101',
        status: 'COMPLETED',
        durationMinutes: 90,
      });

      prismaMock.mentorshipProfile.findUnique.mockResolvedValueOnce({
        userId: 'mentor-1',
        completedSessions: 19, // Reaching 20 on this completion!
        totalHours: 28.5,
        isCertifiedMentor: false,
      });

      prismaMock.mentorshipProfile.update.mockResolvedValueOnce({
        userId: 'mentor-1',
        completedSessions: 20,
        totalHours: 30.0,
        isCertifiedMentor: true,
      });

      const result = await service.completeSession('session-101', 'mentor-1', 90);
      expect(result.mentorStats.completedSessions).toBe(20);
      expect(result.mentorStats.isCertifiedMentor).toBe(true);
      expect(result.mentorStats.totalHours).toBe(30.0);
    });
  });

  describe('MentorshipController API Endpoints', () => {
    it('delegates profile and session requests cleanly', async () => {
      prismaMock.mentorshipProfile.findUnique.mockResolvedValueOnce({
        userId: 'usr-1',
        skills: ['TypeScript'],
      });

      const profile = await controller.getProfile('usr-1');
      expect(profile.userId).toBe('usr-1');
    });
  });
});
