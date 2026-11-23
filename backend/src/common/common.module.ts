import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { FeatureFlagService } from './features/feature-flag.service';

@Global()
@Module({
  providers: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, FeatureFlagService],
  exports: [SystemMetricsService, LoadShedderMiddleware, EtcdWatcherService, FeatureFlagService],
})
export class CommonModule {}
