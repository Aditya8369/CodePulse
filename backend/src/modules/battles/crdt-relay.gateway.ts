import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface CrdtRelayUpdatePayload {
  battleId: string;
  clientId: string;
  clock: number;
  ops: Array<{
    type: 'insert' | 'delete';
    id: string;
    char?: string;
    originId?: string | null;
  }>;
}

export interface CrdtCursorPayload {
  battleId: string;
  userId: string;
  username: string;
  color: string;
  lineNumber: number;
  column: number;
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

@WebSocketGateway({ namespace: '/crdt-relay', cors: { origin: '*' } })
export class CrdtRelayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrdtRelayGateway.name);
  private readonly roomVectors = new Map<string, Record<string, number>>();
  private readonly clientRooms = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.debug(`[CRDT-Relay] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const battleId = this.clientRooms.get(client.id);
    if (battleId) {
      this.clientRooms.delete(client.id);
      this.server.to(battleId).emit('crdt:cursor_left', { socketId: client.id });
    }
    this.logger.debug(`[CRDT-Relay] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('crdt:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; userId: string; username: string },
  ) {
    client.join(data.battleId);
    this.clientRooms.set(client.id, data.battleId);

    const roomVector = this.roomVectors.get(data.battleId) || {};
    client.emit('crdt:state_vector', { battleId: data.battleId, vector: roomVector });

    this.logger.log(`[CRDT-Relay] User ${data.username} joined room ${data.battleId}`);
    return { joined: true, battleId: data.battleId };
  }

  @SubscribeMessage('crdt:update')
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CrdtRelayUpdatePayload,
  ) {
    // Update server state vector
    const vector = this.roomVectors.get(data.battleId) || {};
    vector[data.clientId] = Math.max(vector[data.clientId] || 0, data.clock);
    this.roomVectors.set(data.battleId, vector);

    // Broadcast to other participants in the battle room
    client.to(data.battleId).emit('crdt:remote_update', data);
    return { acknowledged: true, clock: data.clock };
  }

  @SubscribeMessage('crdt:cursor')
  handleCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CrdtCursorPayload,
  ) {
    // Broadcast remote cursor and selection position
    client.to(data.battleId).emit('crdt:remote_cursor', data);
  }

  @SubscribeMessage('crdt:sync_request')
  handleSyncRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; clientVector: Record<string, number> },
  ) {
    const serverVector = this.roomVectors.get(data.battleId) || {};
    client.emit('crdt:sync_response', {
      battleId: data.battleId,
      serverVector,
    });
  }
}
