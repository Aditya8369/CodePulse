import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './webhooks.controller';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { WebhookConsumer } from './webhook.consumer';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'webhook-delivery',
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhookDispatcherService, WebhookConsumer],
  exports: [WebhookDispatcherService, WebhookConsumer],
})
export class WebhooksModule {}
