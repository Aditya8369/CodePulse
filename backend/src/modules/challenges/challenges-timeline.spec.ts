import { ChallengesService } from './challenges.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Challenge activity timeline', () => {
  it('records a challenge event only on completion', async () => {
    const challenge = {
      id: 'challenge-1',
      title: 'Daily Committer',
      target: 3,
      xpReward: 50,
    };
    const prisma = {
      challenge: { findMany: jest.fn().mockResolvedValue([challenge]) },
      userChallenge: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'progress-1',
            progress: 1,
            isCompleted: false,
          })
          .mockResolvedValueOnce({
            id: 'progress-1',
            progress: 2,
            isCompleted: false,
          })
          .mockResolvedValueOnce({
            id: 'progress-1',
            progress: 3,
            isCompleted: true,
          }),
        update: jest.fn().mockResolvedValue({}),
      },
      developerRating: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
      activity: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new ChallengesService(prisma as unknown as PrismaService);

    await service.processUserActivity('alice', 'commits');
    await service.processUserActivity('alice', 'commits');
    await service.processUserActivity('alice', 'commits');

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: {
        userId: 'alice',
        type: 'CHALLENGE',
        title: 'Completed Daily Committer',
        description: 'Earned 50 XP for completing a challenge.',
        metadata: { challengeId: challenge.id },
      },
    });
    expect(prisma.activity.create).toHaveBeenCalledTimes(1);
  });
});
