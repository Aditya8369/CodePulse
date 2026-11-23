import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { DistributedDeadlockDetectorService } from './concurrency/deadlock-detector.service';

@Global()
@Module({
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, DistributedDeadlockDetectorService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, DistributedDeadlockDetectorService],
})
export class CommonModule {}
