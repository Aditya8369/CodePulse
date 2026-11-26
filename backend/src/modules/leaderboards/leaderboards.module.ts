import { SecurityModule } from '../security/security.module';
import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';
import { GithubSyncService } from './github-sync.service';
import { RankingService } from './ranking.service';
import { CountryNormalizerService } from './country-normalizer.service';
import { LeaderboardWorker } from './leaderboard.worker';
import { ZscoreNormalizerService } from './zscore-normalizer.service';
import { ShardedLeaderboardService } from './sharded-leaderboard.service';
import { MaterializedViewRefreshService } from './materialized-view-refresh.service';

@Module({
  imports: [SecurityModule, QueuesModule],
  controllers: [LeaderboardsController],
  providers: [
    LeaderboardsService,
    GithubSyncService,
    RankingService,
    CountryNormalizerService,
    LeaderboardWorker,
    ZscoreNormalizerService,
    ShardedLeaderboardService,
    MaterializedViewRefreshService,
  ],
  exports: [
    LeaderboardsService,
    ZscoreNormalizerService,
    ShardedLeaderboardService,
    MaterializedViewRefreshService,
  ],
})
export class LeaderboardsModule {}
