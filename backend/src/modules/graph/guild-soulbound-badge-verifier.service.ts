import { Injectable, Logger } from '@nestjs/common';

export interface SoulboundBadge {
  badgeId: string;
  recipientId: string;
  mintedAt: number;
}

@Injectable()
export class GuildSoulboundBadgeVerifierService {
  private readonly logger = new Logger(GuildSoulboundBadgeVerifierService.name);
  private badges = new Map<string, SoulboundBadge>(); // badgeId -> badge

  public mintBadge(badgeId: string, recipientId: string): SoulboundBadge {
    const badge: SoulboundBadge = { badgeId, recipientId, mintedAt: Date.now() };
    this.badges.set(badgeId, badge);
    return badge;
  }

  public transferBadge(badgeId: string, fromId: string, toId: string): { success: boolean; error?: string } {
    const badge = this.badges.get(badgeId);
    if (!badge) return { success: false, error: 'BADGE_NOT_FOUND' };
    this.logger.warn(`Attempted transfer of soulbound badge ${badgeId} from ${fromId} to ${toId} blocked.`);
    return { success: false, error: 'NON_TRANSFERABLE_SOULBOUND' };
  }
}
