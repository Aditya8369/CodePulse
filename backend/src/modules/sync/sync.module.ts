import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncCronService } from './sync.cron';
import { GithubModule } from '../github/github.module';
import { QueuesModule } from '../queues/queues.module';
import { SyncWorker } from './sync.worker';

@Module({
  imports: [GithubModule, QueuesModule],
  providers: [SyncService, SyncCronService, SyncWorker],
  exports: [SyncService, SyncCronService],
})
export class SyncModule {}
