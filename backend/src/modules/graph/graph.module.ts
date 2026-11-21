import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeveloperGraphService } from './developer-graph.service';
import { GraphController } from './graph.controller';
import { GraphSyncWorker } from './graph-sync.worker';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'graph-sync',
    }),
  ],
  controllers: [GraphController],
  providers: [DeveloperGraphService, GraphSyncWorker],
  exports: [DeveloperGraphService],
})
export class GraphModule {}
