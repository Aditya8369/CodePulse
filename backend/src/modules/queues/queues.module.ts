import { Module } from '@nestjs/common';
import { DeadLetterQueueService } from './dlq.service';
import { SyncQueueProcessor } from './sync-queue.processor';

@Module({
  providers: [DeadLetterQueueService, SyncQueueProcessor],
  exports: [DeadLetterQueueService, SyncQueueProcessor],
})
export class QueuesModule {}
