import { Module } from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { SeasonResetService } from './season-reset.service';
import { BullModule } from '@nestjs/bullmq';
import { RatingDecayService } from './rating-decay.service';
import { RatingDecayWorker } from './rating-decay.worker';
import { RatingDecayScheduler } from './rating-decay.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: 'rating-decay' })],
  controllers: [BattlesController],
  providers: [
    BattlesService,
    BattlesGateway,
    SeasonResetService,
    RatingDecayService,
    RatingDecayWorker,
    RatingDecayScheduler,
  ],
  exports: [BattlesService, BattlesGateway],
})
export class BattlesModule {}
