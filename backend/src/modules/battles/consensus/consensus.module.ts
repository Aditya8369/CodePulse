import { Module } from '@nestjs/common';
import { RaftStateService } from './raft-state.service';
import { WalLogService } from './wal-log.service';
import { DistributedLeaderElectionService } from './leader-election.service';

@Module({
  providers: [RaftStateService, WalLogService, DistributedLeaderElectionService],
  exports: [RaftStateService, WalLogService, DistributedLeaderElectionService],
})
export class ConsensusModule {}
