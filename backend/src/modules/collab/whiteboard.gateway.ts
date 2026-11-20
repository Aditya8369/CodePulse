import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WhiteboardService, VectorShape } from './whiteboard.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whiteboard',
})
export class WhiteboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhiteboardGateway.name);

  constructor(private readonly whiteboardService: WhiteboardService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Whiteboard client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Whiteboard client disconnected: ${client.id}`);
    const battleId = client.data?.battleId;
    if (battleId) {
      client.to(`whiteboard:${battleId}`).emit('whiteboard:peer_left', {
        clientId: client.id,
      });
    }
  }

  /**
   * Joins a live collaborative match whiteboard room
   */
  @SubscribeMessage('whiteboard:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; userId: string },
  ) {
    const { battleId, userId } = payload;
    client.data.battleId = battleId;
    client.data.userId = userId;
    client.join(`whiteboard:${battleId}`);

    const board = this.whiteboardService.getOrCreateWhiteboard(battleId);

    return {
      event: 'whiteboard:init',
      data: {
        battleId,
        shapes: board.shapes,
        version: board.version,
      },
    };
  }

  /**
   * Shape creation/mutation broadcast with spatial indexing and lock-free reconciliation
   */
  @SubscribeMessage('whiteboard:shape_update')
  handleShapeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; shape: VectorShape },
  ) {
    const { battleId, shape } = payload;
    const { shape: updatedShape, snapshotVersion } = this.whiteboardService.applyShapeUpdate(
      battleId,
      shape,
    );

    // Broadcast shape update to teammates in the battle room
    client.to(`whiteboard:${battleId}`).emit('whiteboard:shape_update', {
      battleId,
      shape: updatedShape,
      snapshotVersion,
    });

    return { status: 'ack', version: snapshotVersion };
  }

  /**
   * Shape deletion broadcast
   */
  @SubscribeMessage('whiteboard:shape_delete')
  handleShapeDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; shapeId: string },
  ) {
    const { battleId, shapeId } = payload;
    const deleted = this.whiteboardService.deleteShape(battleId, shapeId);

    if (deleted) {
      client.to(`whiteboard:${battleId}`).emit('whiteboard:shape_delete', {
        battleId,
        shapeId,
      });
    }

    return { status: deleted ? 'deleted' : 'not_found' };
  }

  /**
   * Spatial query subscription: returns only shapes within viewer's visible viewport
   */
  @SubscribeMessage('whiteboard:viewport_query')
  handleViewportQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      battleId: string;
      bbox: { minX: number; minY: number; maxX: number; maxY: number };
    },
  ) {
    const { battleId, bbox } = payload;
    const shapes = this.whiteboardService.getShapesInViewport(battleId, bbox);
    return { status: 'ok', shapes };
  }

  /**
   * Export completed whiteboard designs upon match conclusion
   */
  @SubscribeMessage('whiteboard:export')
  async handleExport(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; format: 'svg' | 'mermaid' | 'all' },
  ) {
    const { battleId, format = 'all' } = payload;

    const svg = ['svg', 'all'].includes(format)
      ? this.whiteboardService.exportToSvg(battleId)
      : undefined;
    const mermaid = ['mermaid', 'all'].includes(format)
      ? this.whiteboardService.exportToMermaid(battleId)
      : undefined;

    // Save snapshot in database
    await this.whiteboardService.saveSnapshotToDb(battleId);

    return {
      status: 'exported',
      battleId,
      svg,
      mermaid,
    };
  }
}
