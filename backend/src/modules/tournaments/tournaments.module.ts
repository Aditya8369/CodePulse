import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { DistributedTransactionCoordinator } from './distributed-transaction.service';
import { LeaderElectionService } from './leader-election.service';
import { LeaderElectionController } from './leader-election.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TournamentController, LeaderElectionController],
  providers: [
    TournamentService,
    DistributedTransactionCoordinator,
    LeaderElectionService,
  ],
  exports: [
    TournamentService,
    DistributedTransactionCoordinator,
    LeaderElectionService,
  ],
})
export class TournamentsModule {}
