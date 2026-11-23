import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { DifficultyCalibratorService } from './difficulty-calibrator.service';

import { QueuesModule } from '../queues/queues.module';
import { ChallengesWorker } from './challenges.worker';
import { ChallengesScheduler } from './challenges.scheduler';
import { XpModule } from '../xp/xp.module';
import { HybridSearchService } from './hybrid-search.service';

@Module({
  imports: [QueuesModule, XpModule],
  controllers: [ChallengesController],
  providers: [
    ChallengesService,
    ChallengesWorker,
    ChallengesScheduler,
    HybridSearchService,
    DifficultyCalibratorService,
  ],
  exports: [ChallengesService, HybridSearchService, DifficultyCalibratorService],
})
export class ChallengesModule {}
