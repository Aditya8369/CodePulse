import { Module, Global } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { TokenBucketRateLimitGuard } from './token-bucket-rate-limit.guard';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { PowChallengeGuard } from './pow-challenge.guard';
import { OpaEngineService } from './opa-engine.service';
import { OpaPolicyGuard } from './opa-policy.guard';
import { CsrfGuard } from './csrf.guard';
import { AdaptiveThrottlerGuard } from './adaptive-throttler.guard';
import { IpReputationService } from './ip-reputation.service';

@Global()
@Module({
  providers: [
    RedisService,
    TokenBucketRateLimitGuard,
    CustomThrottlerGuard,
    PowChallengeGuard,
    OpaEngineService,
    OpaPolicyGuard,
    CsrfGuard,
    AdaptiveThrottlerGuard,
    IpReputationService,
  ],
  exports: [
    RedisService,
    TokenBucketRateLimitGuard,
    CustomThrottlerGuard,
    PowChallengeGuard,
    OpaEngineService,
    OpaPolicyGuard,
    CsrfGuard,
    AdaptiveThrottlerGuard,
    IpReputationService,
  ],
})
export class GuardsModule {}
