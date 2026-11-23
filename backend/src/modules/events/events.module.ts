import { Module } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { BattleReadProjection } from './projections/battle-read.projection';
import { EloReadProjection } from './projections/elo-read.projection';

@Module({
  providers: [EventStoreService, BattleReadProjection, EloReadProjection],
  exports: [EventStoreService, BattleReadProjection, EloReadProjection],

import { CdcDispatcherService } from './cdc-dispatcher.service';
import { RedisService } from '../../common/redis/redis.service';
  providers: [CdcDispatcherService, EventStoreService, RedisService],
  exports: [CdcDispatcherService, EventStoreService],
})
export class EventsModule {}
