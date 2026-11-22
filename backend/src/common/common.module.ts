import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';
import { EtcdWatcherService } from '../config/etcd-watcher.service';
import { QuorumWitnessService } from './cluster/quorum-witness.service';

@Global()
@Module({
  providers: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    QuorumWitnessService,
  ],
  exports: [
    SystemMetricsService,
    LoadShedderMiddleware,
    EtcdWatcherService,
    QuorumWitnessService,
  ],
})
export class CommonModule {}
