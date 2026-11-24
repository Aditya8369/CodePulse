import { Injectable, Logger } from '@nestjs/common';

export interface FeedActivity {
  id: string;
  authorId: string;
  content: string;
  timestamp: number;
}

@Injectable()
export class SocialFeedFanoutBufferService {
  private readonly logger = new Logger(SocialFeedFanoutBufferService.name);
  private userInboxes = new Map<string, FeedActivity[]>(); // userId -> activities

  public fanOutActivity(activity: FeedActivity, followerIds: string[]): void {
    for (const fid of followerIds) {
      if (!this.userInboxes.has(fid)) {
        this.userInboxes.set(fid, []);
      }
      const inbox = this.userInboxes.get(fid)!;
      inbox.unshift(activity); // Add to head
      if (inbox.length > 50) {
        inbox.pop(); // Enforce bounded sliding window
      }
    }
  }

  public getInbox(userId: string): FeedActivity[] {
    return [...(this.userInboxes.get(userId) || [])];
  }
}
