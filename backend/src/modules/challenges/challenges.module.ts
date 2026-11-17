import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

import { QueuesModule } from '../queues/queues.module';
import { ChallengesWorker } from './challenges.worker';
import { ChallengesScheduler } from './challenges.scheduler';

@Module({
  imports: [QueuesModule],
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengesWorker, ChallengesScheduler],
  exports: [ChallengesService],
})
export class ChallengesModule {}
