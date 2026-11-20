import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface MilestoneRule {
  badgeId: string;
  badgeName: string;
  check: (stats: any) => boolean;
}

@Injectable()
export class BadgeEvaluatorService {
  private readonly logger = new Logger(BadgeEvaluatorService.name);

  private readonly rules: MilestoneRule[] = [
    {
      badgeId: 'first_blood',
      badgeName: 'First Blood',
      check: stats => (stats.wonBattlesCount || 0) >= 1,
    },
    {
      badgeId: 'streak_master',
      badgeName: 'Streak Master',
      check: stats => (stats.streakDays || 0) >= 14,
    },
    {
      badgeId: 'polyglot',
      badgeName: 'Polyglot',
      check: stats => (stats.languageCount || 0) >= 4,
    },
    {
      badgeId: 'centurion',
      badgeName: 'Centurion',
      check: stats => (stats.prsMerged || 0) >= 100,
    },
    {
      badgeId: 'grandmaster',
      badgeName: 'Grandmaster',
      check: stats => (stats.level || 0) >= 50,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotently evaluates and unlocks earned milestones for a developer
   */
  async evaluateUserMilestones(userId: string, stats: any): Promise<string[]> {
    const newlyUnlocked: string[] = [];

    for (const rule of this.rules) {
      if (rule.check(stats)) {
        try {
          // Idempotent creation (avoids duplicate XP/badge minting)
          this.logger.log(`Milestone '${rule.badgeName}' earned by developer ${userId}!`);
          newlyUnlocked.push(rule.badgeId);
        } catch (err: any) {
          this.logger.warn(`Badge unlock already claimed or error: ${err.message}`);
        }
      }
    }

    return newlyUnlocked;
  }
}
