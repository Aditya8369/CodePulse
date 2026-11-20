import type { Job } from 'bullmq';
import { LeaderboardWorker } from './leaderboard.worker';
import type { PrismaService } from '../../prisma/prisma.service';
import type { GithubSyncService } from './github-sync.service';
import type { RankingService } from './ranking.service';
import type { CountryNormalizerService } from './country-normalizer.service';
import type { Cache } from 'cache-manager';
import type { DeadLetterQueueService } from '../queues/dlq.service';
describe('leaderboard queue failure handling', () => {
  it('reports unavailable upstream statistics as a failure rather than a successful job', async () => {
    const github = { fetchPublicStats: jest.fn().mockResolvedValue(null) };
    const dlq = { capture: jest.fn().mockResolvedValue(undefined) };
    const worker = new LeaderboardWorker(
      {} as PrismaService,
      github as unknown as GithubSyncService,
      {} as RankingService,
      {} as CountryNormalizerService,
      {} as Cache,
      dlq as unknown as DeadLetterQueueService,
    );
    const job = { name: 'sync-user', data: { username: 'demo' } } as Job;
    await expect(worker.process(job)).rejects.toThrow('statistics unavailable');
    await worker.failed(job, new Error('terminal'));
    expect(dlq.capture).toHaveBeenCalledWith(job, expect.any(Error));
  });
});
