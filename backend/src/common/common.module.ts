import { Module, Global } from '@nestjs/common';
import { SystemMetricsService } from './services/system-metrics.service';
import { LoadShedderMiddleware } from './middleware/load-shedder.middleware';
import { DisruptorRingBuffer } from './concurrency/disruptor-ring-buffer';

@Global()
@Module({
  providers: [
    SystemMetricsService,
    LoadShedderMiddleware,
  ],
  exports: [
    SystemMetricsService,
    LoadShedderMiddleware,
  ],
})
export class CommonModule {}
