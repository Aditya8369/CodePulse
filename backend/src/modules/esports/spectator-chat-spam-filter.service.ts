import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpectatorChatSpamFilterService {
  private readonly logger = new Logger(SpectatorChatSpamFilterService.name);
  private userBuckets = new Map<string, number[]>();
  private readonly maxPerWindow = 5;
  private readonly windowMs = 5000;

  public canPost(userId: string, message: string, bannedWords: string[] = []): { allowed: boolean; reason?: string } {
    const lower = message.toLowerCase();
    for (const w of bannedWords) {
      if (lower.includes(w.toLowerCase())) {
        return { allowed: false, reason: 'PROFANITY_OR_TOXICITY' };
      }
    }

    const now = Date.now();
    let history = this.userBuckets.get(userId) || [];
    history = history.filter(t => now - t < this.windowMs);

    if (history.length >= this.maxPerWindow) {
      return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
    }

    history.push(now);
    this.userBuckets.set(userId, history);
    return { allowed: true };
  }
}
