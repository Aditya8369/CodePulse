import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { ZeroCopyStreamService } from './concurrency/zero-copy-stream.service';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';

import { QuorumWitnessService } from './cluster/quorum-witness.service';

@Global()
@Module({
  providers: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    IdempotencyService,
    IdempotencyInterceptor,

    QuorumWitnessService,

    ZeroCopyStreamService,
  ],
  exports: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    IdempotencyService,
    IdempotencyInterceptor,
  ],

import { ReplicaRouter } from './db/replica-router';
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, ReplicaRouter],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, ReplicaRouter],

    QuorumWitnessService,

    ZeroCopyStreamService,

import { FeatureFlagService } from './features/feature-flag.service';
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, FeatureFlagService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, FeatureFlagService],

import { LoadShedderService } from './resilience/load-shedder.service';
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, LoadShedderService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, LoadShedderService],

import { DistributedDeadlockDetectorService } from './concurrency/deadlock-detector.service';
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, DistributedDeadlockDetectorService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, DistributedDeadlockDetectorService],
})
export class CommonModule {}
