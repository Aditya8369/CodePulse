import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RaftQuorumSplitbrainGuardianService {
  private readonly logger = new Logger(RaftQuorumSplitbrainGuardianService.name);
  private role: 'LEADER' | 'FOLLOWER' = 'LEADER';

  public verifyQuorum(activePeers: number, clusterSize: number): boolean {
    const required = Math.floor(clusterSize / 2) + 1;
    const hasQuorum = activePeers >= required;
    if (!hasQuorum && this.role === 'LEADER') {
      this.role = 'FOLLOWER';
      this.logger.error('Lost majority quorum lease. Stepped down to FOLLOWER to prevent split-brain.');
    }
    return hasQuorum;
  }

  public getRole(): 'LEADER' | 'FOLLOWER' {
    return this.role;
  }
}
