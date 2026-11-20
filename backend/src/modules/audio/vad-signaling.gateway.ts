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
import { SpatialAudioService, SpatialAudioConfig } from './spatial-audio.service';

export interface WebRtcSignalPayload {
  battleId: string;
  senderId: string;
  targetId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  signalData: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/audio',
})
export class VadSignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VadSignalingGateway.name);

  constructor(private readonly spatialAudioService: SpatialAudioService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Audio WebRTC client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Audio WebRTC client disconnected: ${client.id}`);
    const battleId = client.data?.battleId;
    const userId = client.data?.userId;
    if (battleId && userId) {
      this.spatialAudioService.removeParticipant(battleId, userId);
      client.to(`audio:${battleId}`).emit('audio:peer_left', { userId, clientId: client.id });
    }
  }

  /**
   * Joins the WebRTC voice mesh and initializes spatial audio panning
   */
  @SubscribeMessage('audio:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      battleId: string;
      userId: string;
      role: 'player1' | 'player2' | 'caster' | 'spectator';
    },
  ) {
    const { battleId, userId, role } = payload;
    client.data.battleId = battleId;
    client.data.userId = userId;
    client.join(`audio:${battleId}`);

    const participantState = this.spatialAudioService.registerParticipant(battleId, userId, role);
    const roomLayout = this.spatialAudioService.getRoomAudioLayout(battleId);

    // Notify peers of new participant with their spatial configuration
    client.to(`audio:${battleId}`).emit('audio:peer_joined', {
      participant: participantState,
    });

    return {
      status: 'connected',
      participant: participantState,
      roomLayout,
    };
  }

  /**
   * Relay WebRTC mesh signaling offers, answers, and ICE candidates (<150ms roundtrip)
   */
  @SubscribeMessage('audio:signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WebRtcSignalPayload,
  ) {
    const { battleId, targetId, signalType, signalData } = payload;

    // Direct peer-to-peer WebRTC signal relay
    this.server.to(`audio:${battleId}`).emit('audio:signal', {
      senderId: client.data?.userId || payload.senderId,
      targetId,
      signalType,
      signalData,
      timestamp: Date.now(),
    });

    return { status: 'relayed', signalType };
  }

  /**
   * Receives Voice Activity Detection (VAD) speech state from client-side analyzer
   * Informs peers whether to decode audio packets, saving up to 60% bandwidth
   */
  @SubscribeMessage('audio:vad_event')
  handleVadEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      battleId: string;
      userId: string;
      isSpeaking: boolean;
      dbLevel?: number;
    },
  ) {
    const { battleId, userId, isSpeaking, dbLevel } = payload;
    const result = this.spatialAudioService.updateVadState(battleId, userId, isSpeaking);

    if (result) {
      // Broadcast VAD speech state to peers so silence is not transmitted
      client.to(`audio:${battleId}`).emit('audio:vad_change', {
        userId,
        isSpeaking,
        dbLevel,
        bandwidthSavingsPercent: result.bandwidthSavingsPercent,
      });
    }

    return { status: 'acknowledged', isSpeaking };
  }

  /**
   * Updates spatial stereo panning and volume sliders (e.g. spectator adjusting Player 1 vs Player 2)
   */
  @SubscribeMessage('audio:adjust_spatial')
  handleAdjustSpatial(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      battleId: string;
      targetUserId: string;
      config: Partial<SpatialAudioConfig>;
    },
  ) {
    const { battleId, targetUserId, config } = payload;
    const updated = this.spatialAudioService.updateSpatialConfig(battleId, targetUserId, config);

    if (updated) {
      client.to(`audio:${battleId}`).emit('audio:spatial_updated', {
        targetUserId,
        config: updated,
      });
    }

    return { status: 'updated', config: updated };
  }
}

