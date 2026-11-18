import { Module } from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { SeasonResetService } from './season-reset.service';
import { BullModule } from '@nestjs/bullmq';
import { RatingDecayService } from './rating-decay.service';
import { RatingDecayWorker } from './rating-decay.worker';
import { RatingDecayScheduler } from './rating-decay.scheduler';
import { BattlesLifecycleScheduler } from './battles-lifecycle.scheduler';
import { BattlesLifecycleWorker } from './battles-lifecycle.worker';
import { MetricsModule } from '../metrics/metrics.module';
import { XpModule } from '../xp/xp.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReplayStreamService } from './replay-stream.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'rating-decay' },
      { name: 'battles-lifecycle' },
    ),
    MetricsModule,
    XpModule,
    AnalyticsModule,
  ],
  controllers: [BattlesController],
  providers: [
    BattlesService,
    BattlesGateway,
    SeasonResetService,
    RatingDecayService,
    RatingDecayWorker,
    RatingDecayScheduler,
    BattlesLifecycleScheduler,
    BattlesLifecycleWorker,
    ReplayStreamService,
  ],
  exports: [BattlesService, BattlesGateway, ReplayStreamService],
})
export class BattlesModule {}
