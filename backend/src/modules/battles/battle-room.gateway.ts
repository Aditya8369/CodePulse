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

export type RoomPhase = 'ROOM_INIT' | 'ROUND_COUNTDOWN' | 'ROUND_ACTIVE' | 'ROUND_SCORING' | 'MATCH_RESULT';

export interface BattleRoomState {
  roomId: string;
  phase: RoomPhase;
  currentRound: number;
  totalRounds: number;
  roundTimeRemaining: number;
  p1: { socketId: string; username: string; score: number; isReady: boolean };
  p2: { socketId: string; username: string; score: number; isReady: boolean };
}

@WebSocketGateway({ namespace: '/battle-room', cors: { origin: '*' } })
export class BattleRoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BattleRoomGateway.name);
  private rooms = new Map<string, BattleRoomState>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to battle arena: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from arena: ${client.id}`);
  }

  @SubscribeMessage('join_arena')
  handleJoinArena(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; username: string }) {
    client.join(data.roomId);
    let room = this.rooms.get(data.roomId);

    if (!room) {
      room = {
        roomId: data.roomId,
        phase: 'ROOM_INIT',
        currentRound: 1,
        totalRounds: 3,
        roundTimeRemaining: 15,
        p1: { socketId: client.id, username: data.username, score: 0, isReady: true },
        p2: { socketId: '', username: 'Opponent', score: 0, isReady: false },
      };
      this.rooms.set(data.roomId, room);
    } else {
      room.p2 = { socketId: client.id, username: data.username, score: 0, isReady: true };
      room.phase = 'ROUND_COUNTDOWN';
      this.startCountdown(room);
    }

    this.server.to(data.roomId).emit('arena_state', room);
  }

  private startCountdown(room: BattleRoomState) {
    let count = 3;
    const interval = setInterval(() => {
      if (count > 0) {
        this.server.to(room.roomId).emit('countdown_tick', { count });
        count--;
      } else {
        clearInterval(interval);
        room.phase = 'ROUND_ACTIVE';
        room.roundTimeRemaining = 15;
        this.server.to(room.roomId).emit('round_start', { round: room.currentRound, time: 15 });
      }
    }, 1000);
  }
}
