import { Global, Module } from '@nestjs/common';
import { HybridLogicalClockService } from './hybrid-logical-clock.service';

@Global()
@Module({
  providers: [
    {
      provide: HybridLogicalClockService,
      useFactory: () => {
        const nodeId = process.env.POD_NAME || process.env.NODE_ID || `pod-${process.pid}`;
        return new HybridLogicalClockService(nodeId, 250);
      },
    },
  ],
  exports: [HybridLogicalClockService],
})
export class ClocksModule {}
