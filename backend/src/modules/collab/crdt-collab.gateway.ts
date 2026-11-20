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
import {
  CrdtCollabService,
  CollabRole,
  CollabPermissionMode,
  CrdtBinaryUpdate,
} from './crdt-collab.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/collab/pair',
})
export class CrdtCollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrdtCollabGateway.name);

  constructor(private readonly crdtCollabService: CrdtCollabService) {}

  handleConnection(client: Socket) {
    this.logger.log(`CRDT Collab client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`CRDT Collab client disconnected: ${client.id}`);
    const docId = client.data?.docId;
    const clientId = client.data?.clientId;

    if (docId && clientId) {
      const removed = this.crdtCollabService.removeParticipant(docId, clientId);
      client.to(docId).emit('collab:participant_left', {
        clientId,
        user: removed ? { id: removed.userId, name: removed.username } : undefined,
      });
      client.to(docId).emit('crdt:awareness:remove', { clientId });
    }
  }

  /**
   * Participant joins the collaborative pair-programming room
   * Establishes initial Yjs sync step 1 and awareness presence
   */
  @SubscribeMessage('collab:join')
  @SubscribeMessage('crdt:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      docId: string;
      clientId: number;
      userId?: string;
      username?: string;
      avatarUrl?: string;
      color?: string;
      role?: CollabRole;
      mode?: CollabPermissionMode;
      stateVector?: Record<number, number>;
    },
  ) {
    const {
      docId,
      clientId,
      userId = `usr_${clientId}`,
      username = `Dev_${clientId}`,
      avatarUrl,
      color = '#3b82f6',
      role = 'pair_programmer',
      mode,
      stateVector = {},
    } = payload;

    client.data.docId = docId;
    client.data.clientId = clientId;
    client.data.role = role;
    client.join(docId);

    const { session, participant, peers } = this.crdtCollabService.joinSession(docId, {
      clientId,
      userId,
      username,
      avatarUrl,
      color,
      role,
      mode,
    });

    // Compute missing delta updates for offline catch-up / state vector sync
    const missingUpdates = this.crdtCollabService.getMissingUpdates(docId, stateVector);

    // Notify peers in room that a new collaborator or spectator joined
    client.to(docId).emit('collab:participant_joined', {
      participant,
      totalParticipants: peers.length + 1,
    });

    return {
      event: 'crdt:sync_step1',
      data: {
        docId,
        content: session.content,
        stateVector: session.stateVector,
        missingUpdates,
        participant,
        peers,
        isFinished: session.isFinished,
      },
    };
  }

  /**
   * Broadcasts low-overhead binary/JSON CRDT update deltas
   * Enforces role permissions (spectators rejected lock-free)
   */
  @SubscribeMessage('collab:update')
  @SubscribeMessage('crdt:update')
  handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      docId: string;
      operation: Omit<CrdtBinaryUpdate, 'id' | 'timestamp'> & { id?: string };
    },
  ) {
    const { docId, operation } = payload;
    const clientId = client.data?.clientId || operation.clientId;

    const result = this.crdtCollabService.applyUpdate(docId, clientId, operation);

    if (!result.applied) {
      if (result.error) {
        return { status: 'forbidden', error: result.error, applied: false };
      }
      // Idempotent duplicate update
      return { status: 'duplicate', applied: false };
    }

    // Broadcast lock-free CRDT delta to all other room peers
    client.to(docId).emit('collab:update', {
      docId,
      operation,
      stateVector: result.session.stateVector,
      canonicalLength: result.session.content.length,
    });

    client.to(docId).emit('crdt:update', {
      docId,
      operation,
      stateVector: result.session.stateVector,
    });

    return {
      status: 'ack',
      applied: true,
      stateVector: result.session.stateVector,
      contentLength: result.session.content.length,
    };
  }

  /**
   * Synchronizes multi-cursor coordinates (line, column), selections, and color avatars
   */
  @SubscribeMessage('collab:awareness')
  @SubscribeMessage('crdt:awareness')
  handleAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      docId: string;
      awareness: {
        clientId: number;
        cursor?: { line: number; column: number };
        selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
      };
    },
  ) {
    const { docId, awareness } = payload;
    const peers = this.crdtCollabService.updateAwareness(docId, awareness);

    // Relay cursor position and selections to room peers
    client.to(docId).emit('collab:awareness', {
      docId,
      awareness,
      peers,
    });

    client.to(docId).emit('crdt:awareness', {
      docId,
      awareness,
      peers,
    });

    return { status: 'ok', peersCount: peers.length };
  }

  /**
   * Sets room permission controls: read-only spectator vs read-write pair programmer
   */
  @SubscribeMessage('collab:set_role')
  handleSetRole(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      docId: string;
      targetClientId: number;
      role: CollabRole;
    },
  ) {
    const { docId, targetClientId, role } = payload;
    const updated = this.crdtCollabService.setParticipantRole(docId, targetClientId, role);

    if (!updated) {
      return { status: 'error', message: 'Participant not found' };
    }

    if (client.data?.clientId === targetClientId) {
      client.data.role = role;
    }

    this.server.to(docId).emit('collab:role_updated', {
      docId,
      participant: updated,
    });

    return { status: 'ok', participant: updated };
  }

  /**
   * Finalizes pair programming session and saves final code to PostgreSQL
   */
  @SubscribeMessage('collab:finish')
  async handleFinish(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { docId: string },
  ) {
    const { docId } = payload;
    const result = await this.crdtCollabService.saveFinalCode(docId);

    this.server.to(docId).emit('collab:finished', {
      docId,
      finalCode: result.finalCode,
      persisted: result.persisted,
    });

    return {
      status: 'finished',
      docId,
      finalCode: result.finalCode,
      persisted: result.persisted,
    };
  }
}
