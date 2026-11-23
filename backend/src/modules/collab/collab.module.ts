import { Module } from '@nestjs/common';
import { CrdtSyncService } from './crdt-sync.service';
import { CollabGateway } from './collab.gateway';
import { CrdtCollabService } from './crdt-collab.service';
import { CrdtCollabGateway } from './crdt-collab.gateway';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardGateway } from './whiteboard.gateway';
import { VectorClockService } from './vector-clock.service';
import { CollabVectorClockController } from './collab.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CollabVectorClockController],
  providers: [
    CrdtSyncService,
    CollabGateway,
    CrdtCollabService,
    CrdtCollabGateway,
    WhiteboardService,
    WhiteboardGateway,
    VectorClockService,
  ],
  exports: [
    CrdtSyncService,
    CrdtCollabService,
    WhiteboardService,
    VectorClockService,
  ],
})
export class CollabModule {}
