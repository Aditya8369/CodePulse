import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { DistributedTransactionCoordinator } from './distributed-transaction.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TournamentController],
  providers: [TournamentService, DistributedTransactionCoordinator],
  exports: [TournamentService, DistributedTransactionCoordinator],
})
export class TournamentsModule {}
