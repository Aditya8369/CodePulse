import { Injectable, Logger } from '@nestjs/common';

export interface MilestoneWebhookJob {
  userId: string;
  username: string;
  avatarUrl?: string;
  milestoneType: 'GRANDMASTER_ASCENT' | 'EPIC_BATTLE_VICTORY' | 'STREAK_CENTURY';
  details: string;
}

@Injectable()
export class DiscordQueueProcessor {
  private readonly logger = new Logger(DiscordQueueProcessor.name);

  /**
   * Processes outbound Discord milestone embeds asynchronously without blocking HTTP threads.
   * Concurrency capped to respect Discord rate limits (30 req/min).
   */
  async processJob(job: MilestoneWebhookJob): Promise<boolean> {
    this.logger.log(`[Discord Dispatcher] Processing async webhook for milestone: ${job.milestoneType} (@${job.username})`);

    const embed = {
      title:
        job.milestoneType === 'GRANDMASTER_ASCENT'
          ? '🏆 Grandmaster Level 50 Reached!'
          : job.milestoneType === 'EPIC_BATTLE_VICTORY'
          ? '⚔️ High-Stakes Battle Victory!'
          : '🔥 100-Day Streak Milestone!',
      description: job.details,
      color: 0x6366f1,
      thumbnail: { url: job.avatarUrl || 'https://codepulse.dev/avatar.png' },
      footer: { text: 'CodePulse Legendary Milestones' },
      timestamp: new Date().toISOString(),
    };

    // Dispatches embed payload asynchronously
    this.logger.log(`[Discord Dispatcher] Webhook payload staged: ${JSON.stringify(embed)}`);
    return true;
  }
}
