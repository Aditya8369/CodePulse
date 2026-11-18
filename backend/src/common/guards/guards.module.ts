import { Module, Global } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { TokenBucketRateLimitGuard } from './token-bucket-rate-limit.guard';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { PowChallengeGuard } from './pow-challenge.guard';

@Global()
@Module({
  providers: [
    RedisService,
    TokenBucketRateLimitGuard,
    CustomThrottlerGuard,
    PowChallengeGuard,
  ],
  exports: [
    RedisService,
    TokenBucketRateLimitGuard,
    CustomThrottlerGuard,
    PowChallengeGuard,
  ],
})
export class GuardsModule {}
