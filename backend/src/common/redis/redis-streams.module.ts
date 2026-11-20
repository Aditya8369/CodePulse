import { Module } from '@nestjs/common';
import { RedisStreamsService } from '../../common/redis/redis-streams.service';

@Module({
  providers: [RedisStreamsService],
  exports: [RedisStreamsService],
})
export class RedisStreamsModule {}

