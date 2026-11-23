import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { LoadShedderService } from './resilience/load-shedder.service';

@Global()
@Module({
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, LoadShedderService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, LoadShedderService],
})
export class CommonModule {}
