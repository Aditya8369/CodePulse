import { Injectable, Logger } from '@nestjs/common';

export interface GuildMemberRecord {
  memberId: string;
  role: 'LEADER' | 'OFFICER' | 'VETERAN' | 'MEMBER';
  lastActiveDaysAgo: number;
}

@Injectable()
export class GuildInactivityDemotionEngineService {
  private readonly logger = new Logger(GuildInactivityDemotionEngineService.name);

  public evaluateDemotions(members: GuildMemberRecord[]): { memberId: string; oldRole: string; newRole: string }[] {
    const demotions: { memberId: string; oldRole: string; newRole: string }[] = [];

    for (const m of members) {
      if (m.role === 'OFFICER' && m.lastActiveDaysAgo > 30) {
        demotions.push({ memberId: m.memberId, oldRole: 'OFFICER', newRole: 'VETERAN' });
      } else if (m.role === 'VETERAN' && m.lastActiveDaysAgo > 60) {
        demotions.push({ memberId: m.memberId, oldRole: 'VETERAN', newRole: 'MEMBER' });
      }
    }

    return demotions;
  }
}
