import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SocialGraphFriendDeadlockFixService {
  private readonly logger = new Logger(SocialGraphFriendDeadlockFixService.name);
  private pendingRequests = new Set<string>();

  public sendRequest(senderId: string, receiverId: string): { status: 'MUTUAL_ACCEPTED' | 'REQUEST_SENT' } {
    const inverseKey = `${receiverId}->${senderId}`;
    const directKey = `${senderId}->${receiverId}`;

    if (this.pendingRequests.has(inverseKey)) {
      // Mutual simultaneous friend requests -> auto-accept to resolve cyclic deadlock
      this.pendingRequests.delete(inverseKey);
      this.logger.log(`Mutual friend request between ${senderId} and ${receiverId} auto-accepted.`);
      return { status: 'MUTUAL_ACCEPTED' };
    }

    this.pendingRequests.add(directKey);
    return { status: 'REQUEST_SENT' };
  }
}
