import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncCronService } from './sync.cron';
import { GithubModule } from '../github/github.module';
import { QueuesModule } from '../queues/queues.module';
import { SyncWorker } from './sync.worker';
import { RedisStreamsModule } from '../../common/redis/redis-streams.module';
import { StreamWorkerService } from './stream-worker.service';

@Module({
  imports: [GithubModule, QueuesModule, RedisStreamsModule],
  providers: [SyncService, SyncCronService, SyncWorker, StreamWorkerService],
  exports: [SyncService, SyncCronService, StreamWorkerService],
})
export class SyncModule {}
