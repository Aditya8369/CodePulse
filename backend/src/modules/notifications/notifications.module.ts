import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DiscordWebhookService } from './discord-webhook.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationOutboxService } from './notification-outbox.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DiscordWebhookService,
    NotificationOutboxService,
  ],
  exports: [
    NotificationsService,
    DiscordWebhookService,
    NotificationOutboxService,
  ],
})
export class NotificationsModule {}
