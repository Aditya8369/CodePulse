import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class SyncCronService {
  private readonly logger = new Logger(SyncCronService.name);
  private isRunning = false;
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('github-sync') private readonly queue: Queue,
  ) {}
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyContributionSync() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const now = new Date();
      const users = await this.prisma.user.findMany({
        where: {
          updatedAt: { gte: new Date(now.getTime() - 30 * 86400000) },
          deletedAt: null,
        },
        select: { id: true },
        take: 200,
        orderBy: { id: 'asc' },
      });
      for (const user of users) {
        await this.queue.add(
          'sync-user',
          { userId: user.id },
          { jobId: `daily-${now.toISOString().slice(0, 10)}-${user.id}` },
        );
      }
      this.logger.log(
        `Scheduled ${users.length} user sync jobs; workers report completion and terminal failures.`,
      );
    } catch {
      this.logger.error(
        'Could not enqueue the complete daily sync batch; existing jobs are retained.',
      );
    } finally {
      this.isRunning = false;
    }
  }
}
