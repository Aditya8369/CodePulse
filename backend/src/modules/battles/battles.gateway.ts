import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MetricsService } from '../metrics/metrics.service';
import { ZkpVerifierService } from '../crypto/zkp-verifier.service';
import type { ZkpVerificationRequest } from '../crypto/zkp-verifier.service';
import { DisruptorRingBuffer } from '../../common/concurrency/disruptor-ring-buffer';
import { WatermarkService } from './watermark.service';
import { PredictionMarketService } from '../esports/prediction-market.service';

interface PlayerState {
  userId: string;
  username: string;
  isReady: boolean;
  socketId: string;
}

interface RoomState {
  battleId: string;
  players: Record<string, PlayerState>;
  currentRound: number;
  totalRounds: number;
  countdownTimer?: NodeJS.Timeout;
}

export interface BattleIngestEvent {
  battleId: string;
  userId: string;
  socketId: string;
  eventType: 'keystroke' | 'test_case_eval' | 'disconnect' | 'player_ready' | 'player_join';
  data: any;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/battles',
})
export class BattlesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  // Pre-allocated LMAX Disruptor Ring Buffer for ultra-high-throughput lock-free event ingestion
  public readonly ringBuffer = new DisruptorRingBuffer<BattleIngestEvent>(65536);
  private drainInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly metrics: MetricsService,
    @Optional() private readonly zkpService?: ZkpVerifierService,
    @Optional() private readonly watermarkService?: WatermarkService,
    @Optional() private readonly predictionMarket?: PredictionMarketService,
  ) {}

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BattlesGateway.name);
  private rooms: Map<string, RoomState> = new Map();
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  afterInit() {
    this.startDisruptorConsumerLoop();
    this.logger.log('BattlesGateway initialized with LMAX Disruptor lock-free ring buffer');
  }

  onModuleDestroy() {
    if (this.drainInterval) {
      clearInterval(this.drainInterval);
      this.drainInterval = null;
    }
  }

  /**
   * Continuous high-frequency consumer draining the Disruptor Ring Buffer
   * with zero GC pauses and deterministic ordering.
   */
  private startDisruptorConsumerLoop() {
    this.drainInterval = setInterval(() => {
      this.ringBuffer.drain((event) => {
        this.processRingBufferEvent(event.payload);
      }, 1024);
    }, 5); // 5ms micro-batching drain
  }

  /**
   * Internal processor for events drained from the lock-free ring buffer.
   */
  private processRingBufferEvent(event: BattleIngestEvent) {
    if (!event) return;
    const { eventType, battleId, userId, data } = event;

    if (eventType === 'keystroke') {
      this.server
        ?.to(`battle:${battleId}`)
        ?.emit('opponent_keystroke_stream', {
          battleId,
          userId,
          deltaLength: data?.delta?.length || 0,
          cursorPosition: data?.cursorPosition,
          timestamp: event.timestamp,
        });
    } else if (eventType === 'test_case_eval') {
      const lockedPool = this.predictionMarket?.lockPoolOnCodeExecution(battleId);
      if (lockedPool && lockedPool.status === 'LOCKED') {
        this.server?.to(`spectator:${battleId}`)?.emit('prediction_pool_locked', {
          battleId,
          poolId: lockedPool.poolId,
          reason: lockedPool.lockReason,
        });
      }
      this.server
        ?.to(`battle:${battleId}`)
        ?.emit('player_test_case_progress', {
          battleId,
          userId,
          passedCount: data?.passedCount,
          totalCount: data?.totalCount,
          executionTimeMs: data?.executionTimeMs,
        });
    } else if (eventType === 'disconnect') {
      this.handlePlayerDisconnectProcessing(event.socketId, userId, battleId);
    }
  }

  handleConnection(client: Socket) {
    this.metrics.socketConnected(client.id);
    this.logger.log(`Client connected to battle socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.metrics.socketDisconnected(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);

    // Identify which room client was in and route through Disruptor Ring Buffer
    for (const [battleId, room] of this.rooms.entries()) {
      for (const [userId, player] of Object.entries(room.players)) {
        if (player.socketId === client.id) {
          this.ringBuffer.publish('disconnect', {
            battleId,
            userId,
            socketId: client.id,
            eventType: 'disconnect',
            data: { username: player.username },
            timestamp: Date.now(),
          });
          return;
        }
      }
    }
  }

  private handlePlayerDisconnectProcessing(socketId: string, userId: string, battleId: string) {
    const room = this.rooms.get(battleId);
    if (!room) return;
    const player = room.players[userId];
    if (!player) return;

    this.logger.warn(
      `Player ${player.username} (${userId}) disconnected from battle ${battleId}`,
    );

    // Broadcast temporary disconnect notice
    this.server
      ?.to(`battle:${battleId}`)
      ?.emit('player_disconnect_warning', {
        userId,
        username: player.username,
        reconnectWindowSeconds: 30,
      });

    // 30-second grace period before forfeiture
    const timeout = setTimeout(() => {
      delete room.players[userId];
      this.server?.to(`battle:${battleId}`)?.emit('player_forfeit', {
        userId,
        username: player.username,
        message: 'Player failed to reconnect within 30 seconds.',
      });
      this.disconnectTimers.delete(socketId);
    }, 30000);

    this.disconnectTimers.set(socketId, timeout);
  }

  /**
   * Route incoming live keystrokes through the Lock-Free Disruptor Ring Buffer.
   */
  @SubscribeMessage('keystroke')
  handleKeystroke(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      delta: string;
      cursorPosition?: number;
    },
  ) {
    this.ringBuffer.publish('keystroke', {
      battleId: data.battleId,
      userId: data.userId,
      socketId: client.id,
      eventType: 'keystroke',
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Route test case evaluation events through the Disruptor Ring Buffer.
   */
  @SubscribeMessage('test_case_eval')
  handleTestCaseEval(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      passedCount: number;
      totalCount: number;
      executionTimeMs?: number;
    },
  ) {
    this.ringBuffer.publish('test_case_eval', {
      battleId: data.battleId,
      userId: data.userId,
      socketId: client.id,
      eventType: 'test_case_eval',
      data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('player_join')
  handlePlayerJoin(
    @MessageBody() data: { battleId: string; userId: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { battleId, userId, username } = data;
    const roomName = `battle:${battleId}`;

    void client.join(roomName);

    if (!this.rooms.has(battleId)) {
      this.rooms.set(battleId, {
        battleId,
        players: {},
        currentRound: 0,
        totalRounds: 5,
      });
    }

    const room = this.rooms.get(battleId)!;

    // Clear any pending disconnect timer if player reconnected
    for (const [socketId, timer] of this.disconnectTimers.entries()) {
      clearTimeout(timer);
      this.disconnectTimers.delete(socketId);
    }

    room.players[userId] = {
      userId,
      username,
      isReady: false,
      socketId: client.id,
    };

    this.logger.log(`User ${username} joined battle room: ${roomName}`);

    // Broadcast updated lobby state
    this.server.to(roomName).emit('lobby_state_update', {
      battleId,
      players: Object.values(room.players),
    });
  }

  @SubscribeMessage('player_ready')
  handlePlayerReady(@MessageBody() data: { battleId: string; userId: string }) {
    const { battleId, userId } = data;
    const room = this.rooms.get(battleId);
    if (!room || !room.players[userId]) return;

    room.players[userId].isReady = true;
    const roomName = `battle:${battleId}`;

    this.server.to(roomName).emit('player_ready_confirmed', {
      userId,
      players: Object.values(room.players),
    });

    // Check if both players are ready
    const playersList = Object.values(room.players);
    if (playersList.length >= 2 && playersList.every((p) => p.isReady)) {
      this.startCountdown(battleId);
    }
  }

  private startCountdown(battleId: string) {
    const roomName = `battle:${battleId}`;
    let secondsLeft = 3;

    this.server.to(roomName).emit('start_countdown', { count: secondsLeft });

    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        this.server
          .to(roomName)
          .emit('start_countdown', { count: secondsLeft });
      } else {
        clearInterval(interval);
        this.server.to(roomName).emit('battle_commenced', {
          round: 1,
          metric: 'Commits',
        });
      }
    }, 1000);
  }

  @SubscribeMessage('round_transition')
  handleRoundTransition(
    @MessageBody()
    data: {
      battleId: string;
      nextRound: number;
      metric: string;
    },
  ) {
    const { battleId, nextRound, metric } = data;
    const room = this.rooms.get(battleId);
    if (room) {
      room.currentRound = nextRound;
      this.server.to(`battle:${battleId}`).emit('round_transition_sync', {
        round: nextRound,
        metric,
      });
    }
  }

  @SubscribeMessage('submit_zkp_solution')
  async handleSubmitZkpSolution(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ZkpVerificationRequest,
  ) {
    if (!this.zkpService) {
      client.emit('zkp_verification_result', {
        valid: false,
        error: 'ZkpVerifierService not configured on gateway',
      });
      return;
    }

    try {
      const result = await this.zkpService.verifyZkpProof(data);
      client.emit('zkp_verification_result', result);

      if (result.valid) {
        this.server.to(`battle:${data.battleId}`).emit('player_solved_private_round', {
          battleId: data.battleId,
          userId: data.userId,
          proofHash: result.proofHash,
          verificationDurationMs: result.verificationDurationMs,
        });
      }
    } catch (err: any) {
      client.emit('zkp_verification_result', {
        valid: false,
        error: err.message,
      });
    }
  }

  @SubscribeMessage('tab_focus_change')
  handleTabFocusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      event: 'blur' | 'focus' | 'visibility_hidden' | 'visibility_visible';
    },
  ) {
    if (this.watermarkService) {
      const recorded = this.watermarkService.recordTabFocusChange(
        data.battleId,
        data.userId,
        data.event,
        Date.now(),
      );

      // Alert battle channel if focus lost
      if (data.event === 'blur' || data.event === 'visibility_hidden') {
        this.server.to(`battle:${data.battleId}`).emit('anti_ghosting_warning', {
          userId: data.userId,
          message: 'Player switched away from active battle screen',
          timestamp: recorded.timestamp,
        });
      }
    }
  }

  @SubscribeMessage('request_spectator_stream')
  handleSpectatorStreamRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      spectatorId: string;
    },
  ) {
    const ipAddress =
      client.handshake.headers['x-forwarded-for']?.toString() ||
      client.handshake.address ||
      '127.0.0.1';

    if (this.watermarkService) {
      const watermark = this.watermarkService.generateSteganographicWatermark({
        spectatorId: data.spectatorId,
        ipAddress,
        timestamp: Date.now(),
        matchId: data.battleId,
      });

      client.emit('spectator_stream_initialized', {
        battleId: data.battleId,
        delaySeconds: this.watermarkService.getSpectatorDelay(),
        watermark: {
          signature: watermark.signature,
          luminanceModulationMap: watermark.luminanceModulationMap,
          timestamp: watermark.timestamp,
        },
      });
    }

    void client.join(`spectator:${data.battleId}`);
  }

  @SubscribeMessage('place_prediction')
  async handlePlacePrediction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      outcomeKey: string;
      stakeBits: number;
    },
  ) {
    if (!this.predictionMarket) return null;
    const outcome = await this.predictionMarket.placePrediction(data);
    this.server
      ?.to(`spectator:${data.battleId}`)
      ?.to(`battle:${data.battleId}`)
      ?.emit('prediction_odds_updated', {
        battleId: data.battleId,
        poolId: outcome.pool.poolId,
        odds: outcome.pool.odds,
        outcomePools: outcome.pool.outcomePools,
        totalPoolBits: outcome.pool.totalPoolBits,
      });
    client.emit('prediction_placed', outcome);
    return outcome;
  }
}
