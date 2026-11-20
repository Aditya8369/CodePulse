import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeadLetterQueueService } from './dlq.service';
import { QueuesController } from './queues.controller';
import { QueuesAdminGuard } from './queues-admin.guard';
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
  providers: [DeadLetterQueueService, QueuesAdminGuard],
  exports: [BullModule, DeadLetterQueueService],
})
export class QueuesModule {}
