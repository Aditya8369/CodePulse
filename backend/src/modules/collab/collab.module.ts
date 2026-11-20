import { Module } from '@nestjs/common';
import { CrdtSyncService } from './crdt-sync.service';
import { CollabGateway } from './collab.gateway';
import { CrdtCollabService } from './crdt-collab.service';
import { CrdtCollabGateway } from './crdt-collab.gateway';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardGateway } from './whiteboard.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    CrdtSyncService,
    CollabGateway,
    CrdtCollabService,
    CrdtCollabGateway,
    WhiteboardService,
    WhiteboardGateway,
  ],
  exports: [CrdtSyncService, CrdtCollabService, WhiteboardService],
})
export class CollabModule {}


