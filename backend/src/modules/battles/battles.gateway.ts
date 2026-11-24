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
import { HypeMeterService, EmojiType } from './hype-meter.service';
import { AiShoutcasterService } from '../esports/ai-shoutcaster.service';
import type { CommentaryStyle, ShoutcasterMatchEvent } from '../esports/ai-shoutcaster.service';
import { RaidBossService } from './raid-boss.service';
import type { RaidBossArchetype, RaidPatchSubmission } from './raid-boss.service';
import { PredictionMarketService } from '../esports/prediction-market.service';
import { SabotageEngineService, SABOTAGE_POWERUPS } from './sabotage-engine.service';
import type { SabotageType, DefenseType } from './sabotage-engine.service';
import { EdgeRelayService } from './edge-relay.service';
import { RoomService } from './room.service';
import type { CreatePrivateRoomDto, JoinPrivateRoomDto, PrivateRoomState } from './room.service';
import { EvaluatorService } from './evaluator.service';
import type { BattlePerformanceMetrics, SuddenDeathSession } from './evaluator.service';
import { PersonaBattleService } from '../ai/persona-battle.service';
import { CodeHintService } from '../ai/code-hint.service';
import { DistributedDisruptorRelayService } from './distributed-disruptor-relay.service';

import { ProtobufStreamService, KeystrokeType } from './protobuf-stream.service';

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
  eventType: 'keystroke' | 'test_case_eval' | 'disconnect' | 'player_ready' | 'player_join' | 'heartbeat';
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
    @Optional() private readonly hypeMeterService?: HypeMeterService,
    @Optional() private readonly shoutcasterService?: AiShoutcasterService,
    @Optional() private readonly raidBossService?: RaidBossService,
    @Optional() private readonly predictionMarket?: PredictionMarketService,
    @Optional() private readonly sabotageEngine?: SabotageEngineService,
    @Optional() private readonly edgeRelayService?: EdgeRelayService,
    @Optional() private readonly roomService?: RoomService,
    @Optional() private readonly evaluatorService?: EvaluatorService,
    @Optional() private readonly personaBattleService?: PersonaBattleService,
    @Optional() private readonly codeHintService?: CodeHintService,
    @Optional() private readonly disruptorRelay?: DistributedDisruptorRelayService,

    @Optional() private readonly protobufStream?: ProtobufStreamService,
  ) {}

  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BattlesGateway.name);
  private rooms: Map<string, RoomState> = new Map();
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private socketRoles: Map<string, { role: 'HOST' | 'PLAYER' | 'SPECTATOR'; roomCode?: string; battleId?: string }> = new Map();

  // Zero-Downtime Socket Rebalancing & Graceful Connection Drainage (#1053)
  private _isDraining = false;
  private drainPollInterval: NodeJS.Timeout | null = null;
  private drainTimeoutTimer: NodeJS.Timeout | null = null;
  private sigtermListener?: () => void;

  public isSocketSpectator(socketId: string): boolean {
    return this.socketRoles.get(socketId)?.role === 'SPECTATOR';
  }

  public isDraining(): boolean {
    return this._isDraining;
  }

  public getActiveMatchCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      if (Object.keys(room.players).length > 0) {
        count++;
      }
    }
    return count;
  }

  public getDrainStatus() {
    return {
      isDraining: this._isDraining,
      activeMatchCount: this.getActiveMatchCount(),
      totalRooms: this.rooms.size,
      totalSockets: this.socketRoles.size,
    };
  }

  public async startDrainage(gracePeriodMs = 120000): Promise<void> {
    if (this._isDraining) return;
    this._isDraining = true;
    this.logger.warn(
      `Zero-downtime socket drainage initiated. Active matches: ${this.getActiveMatchCount()}. Grace period: ${gracePeriodMs}ms`,
    );

    // 1. Notify idle sockets & spectators to rebalance immediately to active pods
    this.socketRoles.forEach((roleInfo, socketId) => {
      if (roleInfo.role === 'SPECTATOR' || !roleInfo.battleId) {
        if (this.server?.to) {
          this.server.to(socketId).emit('socket:rebalance', {
            reason: 'rolling_restart',
            message: 'Pod is undergoing rolling deployment; please migrate to an active pod.',
            gracePeriodMs,
          });
        }
      }
    });

    // 2. Notify active battle rooms that a rolling restart is scheduled but will allow match completion
    for (const battleId of this.rooms.keys()) {
      if (this.server?.to) {
        this.server.to(`battle:${battleId}`).emit('battle:drain_warning', {
          gracePeriodMs,
          message: 'Rolling update in progress; current battle will conclude normally.',
        });
      }
    }

    // 3. Wait for all active matches to conclude or grace period timeout
    return new Promise<void>((resolve) => {
      const startTime = Date.now();

      this.drainPollInterval = setInterval(() => {
        const activeMatches = this.getActiveMatchCount();
        const elapsed = Date.now() - startTime;

        if (activeMatches === 0 || elapsed >= gracePeriodMs) {
          if (this.drainPollInterval) {
            clearInterval(this.drainPollInterval);
            this.drainPollInterval = null;
          }
          if (this.drainTimeoutTimer) {
            clearTimeout(this.drainTimeoutTimer);
            this.drainTimeoutTimer = null;
          }

          this.logger.log(
            `Socket drainage completed. Active matches: ${activeMatches}. Elapsed: ${elapsed}ms. Closing server sockets.`,
          );

          if (this.server?.disconnectSockets) {
            this.server.disconnectSockets(true);
          }
          resolve();
        }
      }, 500);

      this.drainTimeoutTimer = setTimeout(() => {
        if (this.drainPollInterval) {
          clearInterval(this.drainPollInterval);
          this.drainPollInterval = null;
        }
        this.logger.warn(`Drainage grace period (${gracePeriodMs}ms) expired. Forcing shutdown.`);
        if (this.server?.disconnectSockets) {
          this.server.disconnectSockets(true);
        }
        resolve();
      }, gracePeriodMs);
    });
  }

  public cancelDrainage(): void {
    if (this.drainPollInterval) {
      clearInterval(this.drainPollInterval);
      this.drainPollInterval = null;
    }
    if (this.drainTimeoutTimer) {
      clearTimeout(this.drainTimeoutTimer);
      this.drainTimeoutTimer = null;
    }
    this._isDraining = false;
  }

  afterInit() {
    this.startDisruptorConsumerLoop();
    if (this.disruptorRelay) {
      this.disruptorRelay.onCrossPodEvent((crossPodEvent) => {
        this.processRingBufferEvent(crossPodEvent, false);
      });
    }
    if (this.hypeMeterService) {
      this.hypeMeterService.onTick((snapshot) => {
        // Broadcast single aggregated 100ms hype tick to all spectators
        this.server.to(`spectator:${snapshot.battleId}`).emit('hype:tick', snapshot);
      });
    }

    // Hook into SIGTERM for Kubernetes rolling updates
    this.sigtermListener = () => {
      this.logger.warn('SIGTERM received: initiating zero-downtime socket drainage');
      void this.startDrainage();
    };
    if (typeof process !== 'undefined' && process.on) {
      process.on('SIGTERM', this.sigtermListener);
    }

    this.logger.log('BattlesGateway initialized with LMAX Disruptor lock-free ring buffer');
  }

  onModuleDestroy() {
    if (this.sigtermListener && typeof process !== 'undefined' && process.off) {
      process.off('SIGTERM', this.sigtermListener);
    }
    this.cancelDrainage();
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
  private processRingBufferEvent(event: BattleIngestEvent, publishToStream = true) {
    if (!event) return;
    const { eventType, battleId, userId, data } = event;

    if (eventType === 'keystroke') {
      if (publishToStream && this.disruptorRelay) {
        void this.disruptorRelay.publishToStream(battleId, event);
      }
      const emitKeystroke = () => {
        this.server
          ?.to(`battle:${battleId}`)
          ?.emit('opponent_keystroke_stream', {
            battleId,
            userId,
            deltaLength: data?.delta?.length || 0,
            cursorPosition: data?.cursorPosition,
            timestamp: event.timestamp,
          });

        if (this.protobufStream) {
          const binaryBuffer = this.protobufStream.encodeTelemetryFrame({
            battleId,
            userId,
            sequence: data?.sequence || 0,
            timestamp: event.timestamp,
            cursorPosition: data?.cursorPosition || 0,
            deltaLength: data?.delta?.length || 0,
            keystrokeType: KeystrokeType.INSERT,
            key: data?.key,
          });
          this.server?.to(`battle:${battleId}`)?.emit('opponent_keystroke_binary', binaryBuffer);
        }

        // Live spectator stream in read-only mode
        this.server
          ?.to(`spectator:${battleId}`)
          ?.emit('room:spectator_stream', {
            type: 'keystroke_diff',
            battleId,
            userId,
            deltaLength: data?.delta?.length || 0,
            cursorPosition: data?.cursorPosition,
            timestamp: event.timestamp,
          });
      };

      if (this.edgeRelayService) {
        void this.edgeRelayService.publishRelayEvent({
          originRegion: this.edgeRelayService.getLocalRegion(),
          battleId,
          eventType: 'keystroke',
          payload: {
            deltaLength: data?.delta?.length || 0,
            cursorPosition: data?.cursorPosition,
          },
        });
        void this.edgeRelayService.executeWithLatencyBuffer(battleId, userId, emitKeystroke);
      } else {
        emitKeystroke();
      }

      if (this.evaluatorService) {
        this.evaluatorService.recordKeystroke(battleId, userId, event.timestamp);
      }

      if (this.shoutcasterService) {
        const burst = this.shoutcasterService.recordKeystrokeAndDetectBurst(battleId, event.timestamp);
        if (burst.isBurst) {
          void this.broadcastShoutcasterEvent({
            battleId,
            eventType: 'fast_typing_burst',
            actorUsername: this.rooms.get(battleId)?.players[userId]?.username ?? userId,
            wpm: burst.estimatedWpm,
            timestampMs: event.timestamp,
          });
        }
      }
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

      // Live spectator stream in read-only mode
      this.server
        ?.to(`spectator:${battleId}`)
        ?.emit('room:spectator_stream', {
          type: 'test_eval',
          battleId,
          userId,
          passedCount: data?.passedCount,
          totalCount: data?.totalCount,
          executionTimeMs: data?.executionTimeMs,
          timestamp: event.timestamp,
        });
      if (this.shoutcasterService && typeof data?.passedCount === 'number' && typeof data?.totalCount === 'number') {
        const actorName = this.rooms.get(battleId)?.players[userId]?.username ?? userId;
        const isAllPassed = data.passedCount === data.totalCount && data.totalCount > 0;
        void this.broadcastShoutcasterEvent({
          battleId,
          eventType: isAllPassed ? 'optimization_breakthrough' : 'failing_test_cases',
          actorUsername: actorName,
          passedTests: data.passedCount,
          totalTests: data.totalCount,
          complexityAfter: isAllPassed ? 'O(N)' : undefined,
          timestampMs: event.timestamp,
        });
      }
    } else if (eventType === 'disconnect') {
      this.handlePlayerDisconnectProcessing(event.socketId, userId, battleId);
    }
  }

  handleConnection(client: Socket) {
    if (this._isDraining) {
      this.logger.warn(`Rejecting connection ${client.id}: pod is draining for rolling update`);
      client.emit('socket:rebalance', {
        reason: 'pod_draining',
        message: 'Pod is undergoing rolling deployment; please connect to an active pod.',
      });
      client.disconnect(true);
      return;
    }
    this.metrics.socketConnected(client.id);
    this.logger.log(`Client connected to battle socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.metrics.socketDisconnected(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);

    // If client was part of a private room, update room state
    const socketInfo = this.socketRoles.get(client.id);
    if (socketInfo && socketInfo.roomCode && this.roomService) {
      this.socketRoles.delete(client.id);
    }

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
    if (this.isSocketSpectator(client.id)) {
      client.emit('error', { message: 'Spectators are read-only and cannot send keystrokes' });
      return;
    }
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
    if (this.isSocketSpectator(client.id)) {
      client.emit('error', { message: 'Spectators are read-only and cannot evaluate test cases' });
      return;
    }
    this.ringBuffer.publish('test_case_eval', {
      battleId: data.battleId,
      userId: data.userId,
      socketId: client.id,
      eventType: 'test_case_eval',
      data,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('latency_ping')
  handleLatencyPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; userId: string; clientTimestamp: number },
  ) {
    const serverTimestamp = Date.now();
    const rtt = Math.max(1, (serverTimestamp - (data.clientTimestamp || serverTimestamp)) * 2 || 20);
    if (this.edgeRelayService && data.battleId && data.userId) {
      const profile = this.edgeRelayService.recordPlayerPing(data.battleId, data.userId, rtt);
      client.emit('latency_pong', {
        serverTimestamp,
        rttMs: profile.measuredRttMs,
        artificialBufferMs: profile.artificialBufferMs,
        region: profile.region,
      });
    } else {
      client.emit('latency_pong', { serverTimestamp, rttMs: 20 });
    }
  }

  @SubscribeMessage('rollback_frame_sync')
  handleRollbackFrameSync(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      frame: number;
      input: { type: string; char?: string; position: number };
      checksum: number;
    },
  ) {
    client.to(`battle:${data.battleId}`).emit('opponent_rollback_frame', {
      battleId: data.battleId,
      userId: data.userId,
      frame: data.frame,
      input: data.input,
      checksum: data.checksum,
      serverTimestamp: Date.now(),
    });
  }

  // WebRTC P2P Checkpoint Registry: Map<battleId, Map<sequence, Map<userId, string>>>
  private p2pStateCheckpoints = new Map<string, Map<number, Map<string, string>>>();

  @SubscribeMessage('webrtc:p2p_offer')
  handleWebRtcP2pOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; userId: string; sdp: any },
  ) {
    client.to(`battle:${payload.battleId}`).emit('webrtc:p2p_offer', payload);
  }

  @SubscribeMessage('webrtc:p2p_answer')
  handleWebRtcP2pAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; userId: string; sdp: any },
  ) {
    client.to(`battle:${payload.battleId}`).emit('webrtc:p2p_answer', payload);
  }

  @SubscribeMessage('webrtc:p2p_ice_candidate')
  handleWebRtcP2pIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; userId: string; candidate: any },
  ) {
    client.to(`battle:${payload.battleId}`).emit('webrtc:p2p_ice_candidate', payload);
  }

  @SubscribeMessage('webrtc:p2p_fallback_notice')
  handleWebRtcP2pFallback(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { battleId: string; userId: string; reason: string },
  ) {
    this.logger.warn(
      `WebRTC P2P fallback triggered for battle ${payload.battleId} user ${payload.userId}: ${payload.reason}`,
    );
    client.to(`battle:${payload.battleId}`).emit('webrtc:p2p_fallback_notice', payload);
  }

  /**
   * Periodic cryptographic SHA-256 state hash checkpoint verification.
   * Compares player viewports to guarantee zero desynchronization.
   */
  @SubscribeMessage('webrtc:p2p_state_checkpoint')
  handleWebRtcStateCheckpoint(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { battleId: string; userId: string; sequence: number; hash: string; timestamp: number },
  ) {
    const { battleId, userId, sequence, hash } = payload;
    if (!battleId) return;

    if (!this.p2pStateCheckpoints.has(battleId)) {
      this.p2pStateCheckpoints.set(battleId, new Map());
    }
    const battleSeqMap = this.p2pStateCheckpoints.get(battleId)!;
    if (!battleSeqMap.has(sequence)) {
      battleSeqMap.set(sequence, new Map());
    }
    const userHashMap = battleSeqMap.get(sequence)!;
    userHashMap.set(userId, hash);

    if (userHashMap.size >= 2) {
      const hashes = Array.from(userHashMap.values());
      const allMatch = hashes.every((h) => h === hashes[0]);
      if (allMatch) {
        this.server?.to(`battle:${battleId}`)?.emit('webrtc:p2p_state_verified', {
          battleId,
          sequence,
          verified: true,
          hash: hashes[0],
        });
      } else {
        this.logger.warn(`[DESYNC DETECTED] SHA-256 hash mismatch in battle ${battleId} at sequence ${sequence}`);
        this.server?.to(`battle:${battleId}`)?.emit('webrtc:p2p_state_desync', {
          battleId,
          sequence,
          verified: false,
          hashes: Object.fromEntries(userHashMap.entries()),
        });
      }
      battleSeqMap.delete(sequence);
    }
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

  /**
   * Spectator emoji reaction handler
   * Buffers reactions without individual fan-out broadcasts to conserve bandwidth
   */
  @SubscribeMessage('spectator:react')
  handleSpectatorReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      emoji: EmojiType;
    },
  ) {
    if (this.hypeMeterService) {
      this.hypeMeterService.recordReaction({
        battleId: data.battleId,
        userId: data.userId || client.id,
        emoji: data.emoji,
        timestamp: Date.now(),
      });
    }

    return { status: 'buffered' };
  }

  async broadcastShoutcasterEvent(event: ShoutcasterMatchEvent) {
    if (!this.shoutcasterService) return null;
    const outcome = await this.shoutcasterService.processMatchEvent(event);
    if (!outcome.throttled) {
      for (const chunk of outcome.chunks) {
        this.server
          ?.to(`battle:${event.battleId}`)
          ?.to(`spectator:${event.battleId}`)
          ?.emit('shoutcaster_commentary_chunk', chunk);
      }
    }
    return outcome;
  }

  @SubscribeMessage('set_commentary_style')
  handleSetCommentaryStyle(
    @MessageBody() data: { battleId: string; style: CommentaryStyle },
  ) {
    if (!this.shoutcasterService) return { style: data.style };
    const updated = this.shoutcasterService.setBattleStyle(data.battleId, data.style);
    this.server
      ?.to(`battle:${data.battleId}`)
      ?.to(`spectator:${data.battleId}`)
      ?.emit('shoutcaster_style_updated', { battleId: data.battleId, style: updated });
    return { battleId: data.battleId, style: updated };
  }

  @SubscribeMessage('trigger_shoutcaster_event')
  async handleTriggerShoutcasterEvent(
    @MessageBody() event: ShoutcasterMatchEvent,
  ) {
    return this.broadcastShoutcasterEvent(event);
  }

  @SubscribeMessage('join_raid')
  handleJoinRaid(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      raidId: string;
      userId: string;
      username: string;
      archetype?: RaidBossArchetype;
    },
  ) {
    const roomName = `raid:${data.raidId}`;
    void client.join(roomName);
    if (!this.raidBossService) return null;

    this.raidBossService.getOrCreateEncounter(data.raidId, data.archetype);
    const encounter = this.raidBossService.joinRaid(data.raidId, {
      userId: data.userId,
      username: data.username,
    });
    this.server?.to(roomName)?.emit('raid_state_sync', encounter);
    return encounter;
  }

  @SubscribeMessage('submit_raid_patch')
  handleSubmitRaidPatch(
    @MessageBody() submission: RaidPatchSubmission,
  ) {
    if (!this.raidBossService) return null;
    const outcome = this.raidBossService.applyCodePatchStrike(submission);
    const roomName = `raid:${submission.raidId}`;

    this.server?.to(roomName)?.emit('raid_state_sync', outcome.encounter);
    if (outcome.phaseTransitioned) {
      this.server?.to(roomName)?.emit('raid_phase_transition', {
        raidId: submission.raidId,
        newPhase: outcome.newPhase,
        combatLog: outcome.combatLog,
      });
    }
    if (outcome.encounter.status === 'VICTORY') {
      this.server?.to(roomName)?.emit('raid_victory', {
        raidId: submission.raidId,
        rewards: outcome.encounter.rewards,
      });
    }
    return outcome;
  }

  @SubscribeMessage('raid_tick')
  handleRaidTick(
    @MessageBody() data: { raidId: string; elapsedSeconds?: number },
  ) {
    if (!this.raidBossService) return null;
    const encounter = this.raidBossService.tickRaidTimer(
      data.raidId,
      data.elapsedSeconds ?? 1,
    );
    const roomName = `raid:${data.raidId}`;
    this.server?.to(roomName)?.emit('raid_state_sync', encounter);
    if (encounter.status === 'WIPED') {
      this.server?.to(roomName)?.emit('raid_wipe', {
        raidId: data.raidId,
        bossName: encounter.bossName,
      });
    }
    return encounter;
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

  @SubscribeMessage('heartbeat_ping')
  handleHeartbeatPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; timestamp: number },
  ) {
    client.emit('heartbeat_ack', {
      battleId: data.battleId,
      originalTimestamp: data.timestamp,
      serverTimestamp: Date.now(),
    });
  }

  @SubscribeMessage('sabotage:deploy')
  handleSabotageDeploy(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      attackerId: string;
      attackerUsername: string;
      targetId: string;
      targetUsername: string;
      powerupType: SabotageType;
      currentCode: string;
    },
  ) {
    if (!this.sabotageEngine) return null;
    const result = this.sabotageEngine.deploySabotage(data);

    // Broadcast humorous event banner to entire battle room
    this.server?.to(`battle:${data.battleId}`)?.emit('sabotage:announcement', {
      battleId: data.battleId,
      bannerMessage: result.bannerMessage,
      deflected: result.deflected,
      attackerId: data.attackerId,
      targetId: data.targetId,
      powerupType: data.powerupType,
      timestamp: Date.now(),
    });

    // If not deflected, send the mutated code payload to the target player
    if (!result.deflected && result.effect) {
      this.server?.to(`battle:${data.battleId}`)?.emit('sabotage:effect', {
        battleId: data.battleId,
        targetId: data.targetId,
        sabotageId: result.effect.id,
        powerupType: data.powerupType,
        mutatedCode: result.mutatedCode,
        durationMs: SABOTAGE_POWERUPS[data.powerupType]?.durationMs || 30000,
        expiresAt: result.effect.expiresAt,
      });
    }

    client.emit('sabotage:deployed', {
      success: true,
      remainingPoints: result.remainingPoints,
      deflected: result.deflected,
    });

    return result;
  }

  @SubscribeMessage('sabotage:counter')
  handleSabotageCounter(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      username: string;
      defenseType: DefenseType;
      currentCode: string;
    },
  ) {
    if (!this.sabotageEngine) return null;
    const result = this.sabotageEngine.activateDefense(data);

    this.server?.to(`battle:${data.battleId}`)?.emit('sabotage:announcement', {
      battleId: data.battleId,
      bannerMessage: result.bannerMessage,
      userId: data.userId,
      defenseType: data.defenseType,
      timestamp: Date.now(),
    });

    if (data.defenseType === 'CODE_FORMAT_PURGE') {
      this.server?.to(`battle:${data.battleId}`)?.emit('sabotage:purged', {
        battleId: data.battleId,
        userId: data.userId,
        restoredCode: result.restoredCode,
        purgedCount: result.purgedCount,
      });
    }

    client.emit('sabotage:counter_activated', {
      success: true,
      defenseType: data.defenseType,
      remainingPoints: result.remainingPoints,
    });

    return result;
  }

  @SubscribeMessage('sabotage:get_inventory')
  handleSabotageGetInventory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; userId: string; username?: string },
  ) {
    if (!this.sabotageEngine) return null;
    const state = this.sabotageEngine.getOrCreatePlayerState(
      data.battleId,
      data.userId,
      data.username,
    );

    const payload = {
      powerupPoints: state.powerupPoints,
      hasShield: state.hasShield,
      activeSabotages: state.activeSabotages,
      powerupCatalog: SABOTAGE_POWERUPS,
    };

    client.emit('sabotage:inventory_state', payload);
    return payload;
  }

  /**
   * Private Battle Lobby: Create private room with custom ruleset and room code.
   */
  @SubscribeMessage('room:create_private')
  async handleCreatePrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      hostId: string;
      hostUsername: string;
      difficulty?: 'Easy' | 'Medium' | 'Hard';
      allowedLanguages?: string[];
      timeLimitSeconds?: number;
      maxSpectators?: number;
      passcode?: string;
      customRoomCode?: string;
    },
  ) {
    if (!this.roomService) {
      client.emit('room:error', { message: 'RoomService not configured on gateway' });
      return;
    }

    const room = await this.roomService.createPrivateRoom({
      ...data,
    });

    this.socketRoles.set(client.id, {
      role: 'HOST',
      roomCode: room.roomCode,
    });

    void client.join(`room:${room.roomCode}`);

    const payload = {
      roomCode: room.roomCode,
      room,
      shareableLink: `/battles/private/${room.roomCode}`,
    };

    client.emit('room:created', payload);
    return payload;
  }

  /**
   * Private Battle Lobby: Join private room with optional hashed passcode.
   * Supports player and spectator roles.
   */
  @SubscribeMessage('room:join_private')
  async handleJoinPrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomCode: string;
      userId: string;
      username: string;
      passcode?: string;
      role?: 'player' | 'spectator';
    },
  ) {
    if (!this.roomService) {
      client.emit('room:join_error', { message: 'RoomService not configured on gateway' });
      return { success: false, error: 'RoomService unavailable' };
    }

    const result = await this.roomService.joinPrivateRoom({
      ...data,
      socketId: client.id,
    });

    if (!result.success || !result.room) {
      client.emit('room:join_error', { message: result.error || 'Failed to join room' });
      return { success: false, error: result.error };
    }

    const room = result.room;
    const assignedRole = result.role || 'PLAYER';

    this.socketRoles.set(client.id, {
      role: assignedRole,
      roomCode: room.roomCode,
      battleId: room.battleId || undefined,
    });

    void client.join(`room:${room.roomCode}`);

    if (assignedRole === 'SPECTATOR') {
      void client.join(`spectator:${room.roomCode}`);
      if (room.battleId) {
        void client.join(`spectator:${room.battleId}`);
      }

      client.emit('room:joined', {
        room,
        role: 'SPECTATOR',
        message: 'Joined private room as spectator',
      });

      this.server.to(`room:${room.roomCode}`).emit('room:spectator_joined', {
        roomCode: room.roomCode,
        userId: data.userId,
        username: data.username,
        spectatorCount: Object.keys(room.spectators).length,
      });
    } else {
      client.emit('room:joined', {
        room,
        role: assignedRole,
        message: `Joined private room as ${assignedRole}`,
      });

      this.server.to(`room:${room.roomCode}`).emit('room:player_joined', {
        roomCode: room.roomCode,
        player: room.players[data.userId],
        players: Object.values(room.players),
      });
    }

    return { success: true, room, role: assignedRole };
  }

  /**
   * Private Battle Lobby: Player toggles ready status.
   */
  @SubscribeMessage('room:player_ready')
  async handleRoomPlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomCode: string;
      userId: string;
      isReady: boolean;
    },
  ) {
    if (!this.roomService) return;
    const { room, allReady } = await this.roomService.setPlayerReady(
      data.roomCode,
      data.userId,
      data.isReady,
    );

    if (!room) return;

    this.server.to(`room:${room.roomCode}`).emit('room:ready_update', {
      roomCode: room.roomCode,
      userId: data.userId,
      isReady: data.isReady,
      players: Object.values(room.players),
      allReady,
    });

    if (allReady) {
      this.server.to(`room:${room.roomCode}`).emit('room:all_ready', {
        roomCode: room.roomCode,
        readyToStart: true,
        message: 'All players ready! Host may now start the match.',
      });
    }

    return { room, allReady };
  }

  /**
   * Private Battle Lobby: Host starts battle match with custom ruleset.
   */
  @SubscribeMessage('room:start_match')
  async handleRoomStartMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomCode: string;
      userId: string;
      battleId?: string;
    },
  ) {
    if (!this.roomService) return;
    const result = await this.roomService.startMatch(
      data.roomCode,
      data.userId,
      data.battleId,
    );

    if (!result.success || !result.room) {
      client.emit('room:start_error', { message: result.error || 'Failed to start match' });
      return { success: false, error: result.error };
    }

    const room = result.room;
    const battleId = result.battleId!;

    // Initialize battle room in BattlesGateway
    if (!this.rooms.has(battleId)) {
      this.rooms.set(battleId, {
        battleId,
        players: Object.fromEntries(
          Object.entries(room.players).map(([uid, p]) => [
            uid,
            {
              userId: p.userId,
              username: p.username,
              isReady: p.isReady,
              socketId: p.socketId,
            },
          ]),
        ),
        currentRound: 1,
        totalRounds: 1,
      });
    }

    // Bridge all spectator sockets to the new battle spectator channel
    for (const spectator of Object.values(room.spectators)) {
      const sock = this.server?.sockets?.sockets?.get(spectator.socketId);
      if (sock) {
        void sock.join(`spectator:${battleId}`);
      }
    }

    const payload = {
      battleId,
      roomCode: room.roomCode,
      ruleset: {
        difficulty: room.difficulty,
        allowedLanguages: room.allowedLanguages,
        timeLimitSeconds: room.timeLimitSeconds,
      },
      players: Object.values(room.players),
      message: 'Match started!',
    };

    this.server.to(`room:${room.roomCode}`).emit('room:match_started', payload);
    return { success: true, ...payload };
  }

  /**
   * Evaluates tiebreaker between two players using execution runtime, memory, and code conciseness.
   * If composite score is identical, extends timer by 180s and initiates Sudden Death.
   */
  @SubscribeMessage('battle:evaluate_tiebreaker')
  async handleEvaluateTiebreaker(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      player1: BattlePerformanceMetrics;
      player2: BattlePerformanceMetrics;
    },
  ) {
    if (!this.evaluatorService) {
      client.emit('error', { message: 'EvaluatorService not available on gateway' });
      return;
    }

    const { battleId, player1, player2 } = data;
    const result = this.evaluatorService.evaluateTiebreaker(player1, player2);

    if (result.isDraw) {
      // Initiate 3-minute Sudden Death with micro-challenge
      const session = this.evaluatorService.initiateSuddenDeath(battleId);

      const suddenDeathPayload = {
        battleId,
        durationSeconds: session.durationSeconds,
        endsAt: session.endsAt,
        puzzle: {
          puzzleId: session.puzzle.puzzleId,
          title: session.puzzle.title,
          description: session.puzzle.description,
          buggyCode: session.puzzle.buggyCode,
          language: session.puzzle.language,
        },
        message: 'Draw detected! 3-minute Sudden Death initiated! First player to compile without errors and pass wins!',
      };

      // Broadcast to players and spectators
      this.server?.to(`battle:${battleId}`)?.emit('battle:sudden_death', suddenDeathPayload);
      this.server?.to(`spectator:${battleId}`)?.emit('battle:sudden_death', suddenDeathPayload);

      return { outcome: 'SUDDEN_DEATH', session: suddenDeathPayload };
    }

    // Mathematical resolution
    const resolvedPayload = {
      battleId,
      winnerId: result.winnerId,
      reason: result.reason,
      scores: result.scores,
    };

    this.server?.to(`battle:${battleId}`)?.emit('battle:tiebreaker_resolved', resolvedPayload);
    this.server?.to(`spectator:${battleId}`)?.emit('battle:tiebreaker_resolved', resolvedPayload);

    return { outcome: 'RESOLVED', ...resolvedPayload };
  }

  /**
   * Directly triggers sudden death for a battle (e.g. on timer expiration).
   */
  @SubscribeMessage('battle:trigger_sudden_death')
  handleTriggerSuddenDeath(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; customPuzzleId?: string },
  ) {
    if (!this.evaluatorService) return;

    const session = this.evaluatorService.initiateSuddenDeath(
      data.battleId,
      data.customPuzzleId,
    );

    const suddenDeathPayload = {
      battleId: data.battleId,
      durationSeconds: session.durationSeconds,
      endsAt: session.endsAt,
      puzzle: {
        puzzleId: session.puzzle.puzzleId,
        title: session.puzzle.title,
        description: session.puzzle.description,
        buggyCode: session.puzzle.buggyCode,
        language: session.puzzle.language,
      },
      message: 'Sudden Death round commenced! Timer extended by 180 seconds.',
    };

    this.server?.to(`battle:${data.battleId}`)?.emit('battle:sudden_death', suddenDeathPayload);
    this.server?.to(`spectator:${data.battleId}`)?.emit('battle:sudden_death', suddenDeathPayload);

    return suddenDeathPayload;
  }

  /**
   * First player to compile without errors and pass the single sudden-death test immediately secures victory.
   * Broadcasts battle:sudden_death_winner to both players and spectators with full timing breakdown.
   */
  @SubscribeMessage('battle:submit_sudden_death')
  handleSubmitSuddenDeath(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      code: string;
    },
  ) {
    if (!this.evaluatorService) {
      client.emit('battle:sudden_death_eval', { passed: false, error: 'EvaluatorService unavailable' });
      return;
    }

    const { battleId, userId, code } = data;
    const session = this.evaluatorService.getSuddenDeathSession(battleId);

    const result = this.evaluatorService.submitSuddenDeathSolution(battleId, userId, code);

    if (!result.success || !result.isWinner) {
      client.emit('battle:sudden_death_eval', {
        passed: false,
        error: result.error || 'Evaluation failed',
      });
      return { success: false, error: result.error };
    }

    const winnerPayload = {
      battleId,
      winnerId: userId,
      puzzleId: session?.puzzle?.puzzleId,
      timingBreakdown: result.timingBreakdown,
      message: `Player ${userId} solved the micro-puzzle in ${result.timingBreakdown?.timeToSolveMs}ms and secured Sudden Death victory!`,
    };

    // Broadcast victory immediately to both players and spectators
    this.server?.to(`battle:${battleId}`)?.emit('battle:sudden_death_winner', winnerPayload);
    this.server?.to(`spectator:${battleId}`)?.emit('battle:sudden_death_winner', winnerPayload);

    return { success: true, isWinner: true, ...winnerPayload };
  }

  /**
   * Retrieves keystroke velocity statistics (WPM, CPM, burst speed) for a player.
   */
  @SubscribeMessage('battle:get_keystroke_velocity')
  handleGetKeystrokeVelocity(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battleId: string; userId: string },
  ) {
    if (!this.evaluatorService) return null;
    const stats = this.evaluatorService.getKeystrokeVelocity(data.battleId, data.userId);
    client.emit('battle:keystroke_velocity_stats', stats);
    return stats;
  }

  // ==========================================
  // Historical AI Persona Practice Battles (#366)
  // ==========================================

  @SubscribeMessage('get_ai_personas')
  async handleGetAiPersonas(@ConnectedSocket() client: Socket) {
    if (!this.personaBattleService) return [];
    const personas = await this.personaBattleService.getAvailablePersonas();
    client.emit('ai_personas_list', personas);
    return personas;
  }

  @SubscribeMessage('start_ai_practice_battle')
  async handleStartAiPracticeBattle(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      userId: string;
      personaId?: string;
      challengeId?: string;
    },
  ) {
    if (!this.personaBattleService) return null;

    const practice = await this.personaBattleService.startPracticeBattle({
      userId: data.userId || 'anonymous-challenger',
      personaId: data.personaId,
      challengeId: data.challengeId,
    });

    const roomName = `battle:${practice.battleId}`;
    void client.join(roomName);

    // Initialize room state with human and AI persona
    if (!this.rooms.has(practice.battleId)) {
      this.rooms.set(practice.battleId, {
        battleId: practice.battleId,
        players: {
          [data.userId]: {
            userId: data.userId,
            username: 'Challenger',
            isReady: true,
            socketId: client.id,
          },
          [practice.persona.id]: {
            userId: practice.persona.id,
            username: practice.persona.name,
            isReady: true,
            socketId: `ai-${practice.persona.id}`,
          },
        },
        currentRound: 1,
        totalRounds: 1,
      });
    }

    client.emit('practice_battle_started', practice);
    this.server?.to(roomName)?.emit('battle_start', {
      battleId: practice.battleId,
      challenge: practice.challenge,
      opponent: practice.persona,
      isPractice: true,
    });

    // Stream realistic keystrokes matching persona cadence into room
    const frames = this.personaBattleService.generateKeystrokeStream(practice.persona);
    let cumulativeDelay = 0;
    frames.slice(0, 30).forEach((frame) => {
      cumulativeDelay += frame.delayMs;
      setTimeout(() => {
        this.server?.to(roomName)?.emit('opponent_keystroke_stream', {
          battleId: practice.battleId,
          userId: practice.persona.id,
          deltaLength: frame.delta.length,
          cursorPosition: frame.cursorPosition,
          isTypoCorrection: frame.isTypoCorrection,
          timestamp: Date.now(),
        });
      }, cumulativeDelay);
    });

    return practice;
  }

  @SubscribeMessage('battle:request_hint')
  async handleRequestHint(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      battleId: string;
      userId: string;
      tier: number;
      problemTitle?: string;
      problemDescription?: string;
      currentCode?: string;
      language?: string;
      elapsedSeconds?: number;
      totalMatchSeconds?: number;
    },
  ) {
    if (!this.codeHintService) {
      const fallbackPayload = {
        battleId: data.battleId,
        userId: data.userId,
        tier: data.tier,
        error: 'CodeHintService not available',
      };
      client.emit('battle:hint_error', fallbackPayload);
      return fallbackPayload;
    }

    try {
      const hintResult = await this.codeHintService.requestHint({
        battleId: data.battleId,
        userId: data.userId,
        tier: data.tier,
        problemTitle: data.problemTitle,
        problemDescription: data.problemDescription,
        currentCode: data.currentCode,
        language: data.language,
        elapsedSeconds: data.elapsedSeconds,
        totalMatchSeconds: data.totalMatchSeconds,
      });

      // Deliver hint securely in markdown to requesting player
      client.emit('battle:hint_received', hintResult);

      // Notify the battle room / opponent of hint usage and penalty without leaking the hint text
      this.server.to(data.battleId).emit('battle:hint_used', {
        battleId: data.battleId,
        userId: data.userId,
        tier: data.tier,
        tierName: hintResult.tierName,
        penaltyPercent: hintResult.timeDecayedPenaltyPercent,
      });

      return hintResult;
    } catch (err: any) {
      const errorPayload = {
        battleId: data?.battleId,
        userId: data?.userId,
        error: err.message || 'Failed to request hint',
      };
      client.emit('battle:hint_error', errorPayload);
      return errorPayload;
    }
  }
}

