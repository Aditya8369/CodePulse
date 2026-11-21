import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { NotificationOutbox } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CLAIM_NOTIFICATION_SQL,
  MAX_NOTIFICATION_ATTEMPTS,
} from './notification-outbox';

@Injectable()
export class NotificationOutboxService {
  private readonly logger = new Logger(NotificationOutboxService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(2000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.drain();
    } catch {
      this.logger.error(
        'Notification outbox batch failed; pending leases will be retried',
      );
    } finally {
      this.running = false;
    }
  }

  async drain(limit = 25, now = new Date()) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Batch limit must be 1–100');
    // A crash on the final lease must eventually reach a visible terminal state.
    await this.prisma.notificationOutbox.updateMany({
      where: {
        status: 'PROCESSING',
        leaseExpiresAt: { lte: now },
        attempts: { gte: MAX_NOTIFICATION_ATTEMPTS },
      },
      data: {
        status: 'FAILED',
        lastError: 'Final delivery lease expired',
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    const token = randomUUID();
    const rows = await this.prisma.$queryRawUnsafe<NotificationOutbox[]>(
      CLAIM_NOTIFICATION_SQL,
      now,
      new Date(now.getTime() + 60_000),
      token,
      limit,
      MAX_NOTIFICATION_ATTEMPTS,
    );
    let delivered = 0;
    for (const row of rows) {
      try {
        delivered += await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.notificationOutbox.updateMany({
            where: {
              id: row.id,
              status: 'PROCESSING',
              leaseToken: token,
              leaseExpiresAt: { gt: new Date() },
            },
            data: {
              status: 'DELIVERED',
              deliveredAt: new Date(),
              leaseToken: null,
              leaseExpiresAt: null,
              lastError: null,
            },
          });
          if (claimed.count !== 1) return 0;
          // Outbox ID is the inbox primary key. Empty update preserves isRead
          // and the original inbox payload on every replay/repair.
          await tx.notification.upsert({
            where: { id: row.id },
            create: {
              id: row.id,
              userId: row.userId,
              type: row.type,
              title: row.title,
              message: row.message,
            },
            update: {},
          });
          return 1;
        });
      } catch {
        await this.prisma.notificationOutbox.updateMany({
          where: { id: row.id, status: 'PROCESSING', leaseToken: token },
          data: {
            status:
              row.attempts >= MAX_NOTIFICATION_ATTEMPTS ? 'FAILED' : 'PENDING',
            nextAttemptAt: new Date(
              Date.now() + Math.min(300_000, 1000 * 2 ** row.attempts),
            ),
            lastError: 'Inbox projection failed',
            leaseToken: null,
            leaseExpiresAt: null,
          },
        });
      }
    }
    return { claimed: rows.length, delivered };
  }

  /** Operator-only repair; the durable event and inbox deduplication key remain. */
  async retryFailed(id: string) {
    if (!id || id.length > 100) throw new Error('Invalid outbox ID');
    return this.prisma.notificationOutbox.updateMany({
      where: { id, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });
  }
}
