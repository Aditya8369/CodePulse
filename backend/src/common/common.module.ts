import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { ZeroCopyStreamService } from './concurrency/zero-copy-stream.service';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { QuorumWitnessService } from './cluster/quorum-witness.service';
import { EventLoopWatchdogService } from './performance/event-loop-watchdog.service';
import { TaskSharderService } from './performance/task-sharder.service';
import { EventLoopWatchdogController } from './performance/event-loop-watchdog.controller';
import { ReplicaRouter } from './db/replica-router';
import { FeatureFlagService } from './features/feature-flag.service';
import { LoadShedderService } from './resilience/load-shedder.service';
import { DistributedDeadlockDetectorService } from './concurrency/deadlock-detector.service';

import { CloudEventsProvider } from './events/cloudevents.provider';
import { NatsJetStreamService } from './events/nats-jetstream.service';
import { TDigestService } from './math/t-digest.service';

@Global()
@Module({
  controllers: [EventLoopWatchdogController],
  providers: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    IdempotencyService,
    IdempotencyInterceptor,
    QuorumWitnessService,
    EventLoopWatchdogService,
    TaskSharderService,
    ZeroCopyStreamService,
    ReplicaRouter,
    FeatureFlagService,
    LoadShedderService,
    DistributedDeadlockDetectorService,

    CloudEventsProvider,
    NatsJetStreamService,
    TDigestService,
  ],
  exports: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    IdempotencyService,
    IdempotencyInterceptor,
    QuorumWitnessService,
    EventLoopWatchdogService,
    TaskSharderService,
    ZeroCopyStreamService,
    ReplicaRouter,
    FeatureFlagService,
    LoadShedderService,
    DistributedDeadlockDetectorService,

    CloudEventsProvider,
    NatsJetStreamService,
    TDigestService,
  ],
})
export class CommonModule {}
