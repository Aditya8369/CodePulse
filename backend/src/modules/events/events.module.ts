import { Module } from '@nestjs/common';
import { CdcDispatcherService } from './cdc-dispatcher.service';
import { EventStoreService } from './event-store.service';
import { RedisService } from '../../common/redis/redis.service';

@Module({
  providers: [CdcDispatcherService, EventStoreService, RedisService],
  exports: [CdcDispatcherService, EventStoreService],
})
export class EventsModule {}
