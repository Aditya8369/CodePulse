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
})
export class CommonModule {}
