import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DifferentialPrivacyService } from './differential-privacy.service';
import { PrAnalyticsService } from './pr-analytics.service';
import { PrAnalyticsController } from './pr-analytics.controller';
import { BusFactorService } from './bus-factor.service';
import { RepositoryAuthorshipController } from './repository-authorship.controller';
import { ScyllaKeystrokeService } from './scylla-keystroke.service';
import { ScyllaDbTelemetryService } from './scylladb-telemetry.service';
import { ComplexityService } from './complexity.service';
import { MonteCarloVelocityService } from './monte-carlo-velocity.service';

@Module({
  controllers: [
    AnalyticsController,
    PrAnalyticsController,
    RepositoryAuthorshipController,
  ],
  providers: [
    DifferentialPrivacyService,
    AnalyticsService,
    PrAnalyticsService,
    BusFactorService,
    ScyllaKeystrokeService,
    ScyllaDbTelemetryService,
    ComplexityService,
    MonteCarloVelocityService,
  ],
  exports: [
    AnalyticsService,
    DifferentialPrivacyService,
    ScyllaKeystrokeService,
    ScyllaDbTelemetryService,
    ComplexityService,
    MonteCarloVelocityService,
  ],
})
export class AnalyticsModule {}
