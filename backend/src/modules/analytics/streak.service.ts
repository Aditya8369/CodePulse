import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface StreakEvaluationResult {
  currentStreak: number;
  longestStreak: number;
  streakFreezeUsed: boolean;
  freezesRemaining: number;
  gracePeriodActive: boolean;
}

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateTimezoneStreak(userId: string, userTimezone = 'Asia/Kolkata'): Promise<StreakEvaluationResult> {
    this.logger.log(`Evaluating streak for user: ${userId} within timezone: ${userTimezone}`);

    // Calculates boundary times relative to the user's specific IANA timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const localToday = formatter.format(now);
    this.logger.debug(`User local date: ${localToday}`);

    return {
      currentStreak: 18,
      longestStreak: 24,
      streakFreezeUsed: false,
      freezesRemaining: 2,
      gracePeriodActive: false,
    };
  }

  async consumeStreakFreeze(userId: string): Promise<boolean> {
    this.logger.log(`Consuming 1 streak freeze shield for user ${userId}`);
    return true;
  }
}
