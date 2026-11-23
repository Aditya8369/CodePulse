import { Module } from '@nestjs/common';
import { RaftStateService } from './raft-state.service';
import { WalLogService } from './wal-log.service';
import { LeaderElectionService } from './leader-election.service';

@Module({
  providers: [RaftStateService, WalLogService, LeaderElectionService],
  exports: [RaftStateService, WalLogService, LeaderElectionService],
})
export class ConsensusModule {}
