import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeadLetterQueueService } from './dlq.service';
import { QueuesController } from './queues.controller';
import { QueuesAdminGuard } from './queues-admin.guard';
import { QueueStallReconciliationService } from './queue-stall-reconciliation.service';
import { RETRY_POLICY, SOURCE_QUEUES } from './queue-policy';

@Module({
  imports: [
    BullModule.registerQueue(
      ...SOURCE_QUEUES.map((name) => ({
        name,
        defaultJobOptions: RETRY_POLICY,
      })),
      { name: 'dead-letter' },
    ),
  ],
  controllers: [QueuesController],
  providers: [DeadLetterQueueService, QueuesAdminGuard, QueueStallReconciliationService],
  exports: [BullModule, DeadLetterQueueService, QueueStallReconciliationService],
})
export class QueuesModule {}
