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
  CasterStudioService,
  CameraActivePlayer,
  LowerThirdConfig,
  StatComparisonConfig,
  SlowMoReplayConfig,
  LiveTelemetry,
} from './caster-studio.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/caster-studio',
})
export class CasterStudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CasterStudioGateway.name);

  constructor(private readonly studioService: CasterStudioService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Caster studio client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Caster studio client disconnected: ${client.id}`);
    this.studioService.removeCasterAuth(client.id);
  }

  /**
   * Caster/Director authentication with role verification
   */
  @SubscribeMessage('director:auth')
  handleDirectorAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      tournamentId: string;
      userId: string;
      role?: 'DIRECTOR' | 'CASTER' | 'PRODUCER' | 'ADMIN';
    },
  ) {
    const { tournamentId, userId, role = 'DIRECTOR' } = payload;
    this.studioService.registerCasterAuth(client.id, {
      userId,
      role,
      tournamentId,
    });
    client.data.tournamentId = tournamentId;
    client.data.userId = userId;
    client.join(`studio:${tournamentId}`);

    const state = this.studioService.getOrCreateStudioState(tournamentId);
    return { status: 'authenticated', state };
  }

  /**
   * OBS Browser Source Overlay join
   */
  @SubscribeMessage('overlay:join')
  handleOverlayJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string },
  ) {
    const { tournamentId } = payload;
    client.data.tournamentId = tournamentId;
    client.join(`overlay:${tournamentId}`);

    const state = this.studioService.getOrCreateStudioState(tournamentId);
    return { event: 'overlay:init', state };
  }

  /**
   * Director switches camera
   */
  @SubscribeMessage('camera:switch_active_player')
  handleSwitchCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string; camera: CameraActivePlayer },
  ) {
    const { tournamentId, camera } = payload;
    this.studioService.verifyDirectorPermission(client.id, tournamentId);
    const updated = this.studioService.switchActiveCamera(
      tournamentId,
      camera,
      client.data?.userId || client.id,
    );

    // Fast < 50ms broadcast to all OBS overlays and studio viewers
    this.server.to(`overlay:${tournamentId}`).emit('overlay:state_update', updated);
    this.server.to(`studio:${tournamentId}`).emit('studio:state_update', updated);

    return { status: 'applied', activeCamera: updated.activeCamera };
  }

  /**
   * Director triggers lower-third graphic
   */
  @SubscribeMessage('overlay:show_lower_third')
  handleShowLowerThird(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string; config: Partial<LowerThirdConfig> },
  ) {
    const { tournamentId, config } = payload;
    this.studioService.verifyDirectorPermission(client.id, tournamentId);
    const updated = this.studioService.updateLowerThird(
      tournamentId,
      config,
      client.data?.userId || client.id,
    );

    this.server.to(`overlay:${tournamentId}`).emit('overlay:state_update', updated);
    this.server.to(`studio:${tournamentId}`).emit('studio:state_update', updated);

    return { status: 'applied', lowerThird: updated.lowerThird };
  }

  /**
   * Director triggers stat comparison
   */
  @SubscribeMessage('overlay:trigger_stat_comparison')
  handleTriggerStatComparison(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string; config: Partial<StatComparisonConfig> },
  ) {
    const { tournamentId, config } = payload;
    this.studioService.verifyDirectorPermission(client.id, tournamentId);
    const updated = this.studioService.triggerStatComparison(
      tournamentId,
      config,
      client.data?.userId || client.id,
    );

    this.server.to(`overlay:${tournamentId}`).emit('overlay:state_update', updated);
    this.server.to(`studio:${tournamentId}`).emit('studio:state_update', updated);

    return { status: 'applied', statComparison: updated.statComparison };
  }

  /**
   * Director triggers slow-mo instant replay
   */
  @SubscribeMessage('match:trigger_slow_mo_replay')
  handleTriggerSlowMoReplay(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string; config: Partial<SlowMoReplayConfig> },
  ) {
    const { tournamentId, config } = payload;
    this.studioService.verifyDirectorPermission(client.id, tournamentId);
    const updated = this.studioService.triggerSlowMoReplay(
      tournamentId,
      config,
      client.data?.userId || client.id,
    );

    this.server.to(`overlay:${tournamentId}`).emit('overlay:state_update', updated);
    this.server.to(`studio:${tournamentId}`).emit('studio:state_update', updated);

    return { status: 'applied', slowMoReplay: updated.slowMoReplay };
  }

  /**
   * Live match telemetry sync (WPM, tests, win probability)
   */
  @SubscribeMessage('telemetry:update')
  handleTelemetryUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tournamentId: string; telemetry: Partial<LiveTelemetry> },
  ) {
    const { tournamentId, telemetry } = payload;
    const updated = this.studioService.updateTelemetry(tournamentId, telemetry);

    this.server.to(`overlay:${tournamentId}`).emit('overlay:telemetry', updated.telemetry);
    return { status: 'synced' };
  }
}

