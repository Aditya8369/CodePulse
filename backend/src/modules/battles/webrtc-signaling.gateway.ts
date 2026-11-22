import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SignalingOfferAnswerPayload {
  battleId: string;
  targetId: string;
  sdp: {
    type: 'offer' | 'answer';
    sdp: string;
  };
}

export interface SignalingIceCandidatePayload {
  battleId: string;
  targetId: string;
  candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string | null;
  };
}

export interface SignalingJoinPayload {
  battleId: string;
  userId: string;
  username: string;
}

export interface SignalingMutePayload {
  battleId: string;
  isMuted: boolean;
}

export const DEFAULT_ICE_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:turn.codepulse.dev:3478',
    username: 'codepulse_player',
    credential: 'ephemeral_turn_secret_key',
  },
];

@Injectable()
@WebSocketGateway({
  namespace: '/webrtc-signaling',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class WebRtcSignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebRtcSignalingGateway.name);

  @WebSocketServer()
  server!: Server;

  // Track room participants: Map<battleId, Map<socketId, { userId: string; username: string }>>
  private readonly rooms = new Map<string, Map<string, { userId: string; username: string }>>();

  handleConnection(client: Socket) {
    this.logger.log(`WebRTC Signaling peer connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebRTC Signaling peer disconnected: ${client.id}`);
    this.removeClientFromAllRooms(client.id);
  }

  /**
   * Player joins battle voice room. Notifies existing peers and returns room peer list.
   */
  @SubscribeMessage('webrtc:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingJoinPayload,
  ) {
    const { battleId, userId, username } = payload;
    client.join(battleId);

    if (!this.rooms.has(battleId)) {
      this.rooms.set(battleId, new Map());
    }

    const room = this.rooms.get(battleId)!;
    room.set(client.id, { userId, username });

    // Collect other existing peers in the room
    const existingPeers: Array<{ socketId: string; userId: string; username: string }> = [];
    room.forEach((peer, socketId) => {
      if (socketId !== client.id) {
        existingPeers.push({ socketId, userId: peer.userId, username: peer.username });
      }
    });

    // Notify caller with room metadata and ICE config
    client.emit('webrtc:room-joined', {
      peerId: client.id,
      battleId,
      peers: existingPeers,
      iceServers: DEFAULT_ICE_SERVERS,
    });

    // Notify existing room members that new peer arrived
    client.to(battleId).emit('webrtc:peer-joined', {
      peerId: client.id,
      userId,
      username,
    });
  }

  /**
   * Forwards SDP Offer from initiator directly to target peer.
   */
  @SubscribeMessage('webrtc:offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingOfferAnswerPayload,
  ) {
    const { targetId, sdp, battleId } = payload;
    if (this.server?.to) {
      this.server.to(targetId).emit('webrtc:offer', {
        senderId: client.id,
        battleId,
        sdp,
      });
    }
  }

  /**
   * Forwards SDP Answer from target peer back to initiator.
   */
  @SubscribeMessage('webrtc:answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingOfferAnswerPayload,
  ) {
    const { targetId, sdp, battleId } = payload;
    if (this.server?.to) {
      this.server.to(targetId).emit('webrtc:answer', {
        senderId: client.id,
        battleId,
        sdp,
      });
    }
  }

  /**
   * Exchanges ICE Candidates for NAT/Firewall traversal.
   */
  @SubscribeMessage('webrtc:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingIceCandidatePayload,
  ) {
    const { targetId, candidate, battleId } = payload;
    if (this.server?.to) {
      this.server.to(targetId).emit('webrtc:ice-candidate', {
        senderId: client.id,
        battleId,
        candidate,
      });
    }
  }

  /**
   * Broadcasts mute/unmute state to peers in the same battle.
   */
  @SubscribeMessage('webrtc:mute-state')
  handleMuteState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalingMutePayload,
  ) {
    client.to(payload.battleId).emit('webrtc:peer-mute-state', {
      peerId: client.id,
      isMuted: payload.isMuted,
    });
  }

  /**
   * Handles peer leaving voice channel gracefully.
   */
  @SubscribeMessage('webrtc:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string },
  ) {
    const { battleId } = payload;
    client.leave(battleId);
    const room = this.rooms.get(battleId);
    if (room) {
      room.delete(client.id);
      if (room.size === 0) {
        this.rooms.delete(battleId);
      }
    }
    client.to(battleId).emit('webrtc:peer-left', {
      peerId: client.id,
      battleId,
    });
  }

  /**
   * Measures signaling round-trip latency.
   */
  @SubscribeMessage('webrtc:ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() payload: { clientTime: number }) {
    client.emit('webrtc:pong', {
      clientTime: payload.clientTime,
      serverTime: Date.now(),
    });
  }

  /**
   * Cleans up disconnected sockets from internal room state.
   */
  private removeClientFromAllRooms(socketId: string) {
    this.rooms.forEach((room, battleId) => {
      if (room.has(socketId)) {
        room.delete(socketId);
        if (this.server?.to) {
          this.server.to(battleId).emit('webrtc:peer-left', {
            peerId: socketId,
            battleId,
          });
        }
        if (room.size === 0) {
          this.rooms.delete(battleId);
        }
      }
    });
  }

  /**
   * Helper to retrieve active room peer count (used in testing/diagnostics).
   */
  getRoomPeerCount(battleId: string): number {
    return this.rooms.get(battleId)?.size ?? 0;
  }
}
