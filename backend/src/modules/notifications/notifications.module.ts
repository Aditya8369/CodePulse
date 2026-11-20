import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailDigestService } from './email-digest.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailDigestService],
  exports: [NotificationsService, EmailDigestService],
})
export class NotificationsModule {}
