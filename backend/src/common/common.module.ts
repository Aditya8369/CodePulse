import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { ReplicaRouter } from './db/replica-router';

@Global()
@Module({
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, ReplicaRouter],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, ReplicaRouter],
})
export class CommonModule {}
