import { Module } from '@nestjs/common';
import { CrdtSyncService } from './crdt-sync.service';
import { CollabGateway } from './collab.gateway';
import { WhiteboardService } from './whiteboard.service';
import { WhiteboardGateway } from './whiteboard.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CrdtSyncService, CollabGateway, WhiteboardService, WhiteboardGateway],
  exports: [CrdtSyncService, WhiteboardService],
})
export class CollabModule {}

