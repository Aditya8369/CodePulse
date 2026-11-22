import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

export type RoomDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface CreatePrivateRoomDto {
  hostId: string;
  hostUsername: string;
  difficulty?: RoomDifficulty;
  allowedLanguages?: string[];
  timeLimitSeconds?: number;
  maxSpectators?: number;
  passcode?: string;
  customRoomCode?: string;
}

export interface RoomPlayer {
  userId: string;
  username: string;
  socketId: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
  joinedAt: number;
}

export interface RoomSpectator {
  userId: string;
  username: string;
  socketId: string;
  joinedAt: number;
}

export type RoomStatus =
  | 'WAITING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED';

export interface PrivateRoomState {
  roomCode: string;
  hostId: string;
  hostUsername: string;
  difficulty: RoomDifficulty;
  allowedLanguages: string[];
  timeLimitSeconds: number;
  maxSpectators: number;
  passcodeHash?: string | null;
  hasPasscode: boolean;
  status: RoomStatus;
  players: Record<string, RoomPlayer>;
  spectators: Record<string, RoomSpectator>;
  battleId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JoinPrivateRoomDto {
  roomCode: string;
  userId: string;
  username: string;
  socketId: string;
  passcode?: string;
  role?: 'player' | 'spectator';
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  // 1-hour Redis TTL (3600 seconds)
  public static readonly ROOM_TTL_SECONDS = 3600;

  // In-memory fallback mirror for low latency and zero-dependency testing
  private memoryRooms: Map<string, PrivateRoomState> = new Map();

  constructor(
    private readonly redisService: RedisService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  /**
   * Generates a 6-character alphanumeric room code formatted like 'BTL-892' or 'BTL-XXX'.
   */
  public generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let suffix = '';
    for (let i = 0; i < 3; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BTL-${suffix}`;
  }

  /**
   * Cryptographically hashes room passcode using SHA-256.
   */
  public hashPasscode(passcode: string): string {
    return crypto.createHash('sha256').update(passcode.trim()).digest('hex');
  }

  /**
   * Verifies candidate passcode against stored SHA-256 hash.
   */
  public verifyPasscode(passcode: string, storedHash: string): boolean {
    if (!passcode || !storedHash) return false;
    const candidateHash = this.hashPasscode(passcode);
    return candidateHash === storedHash;
  }

  /**
   * Creates a private battle lobby with custom ruleset, 1-hour Redis hash expiration,
   * and optional passcode protection.
   */
  async createPrivateRoom(dto: CreatePrivateRoomDto): Promise<PrivateRoomState> {
    const roomCode = (dto.customRoomCode || this.generateRoomCode()).toUpperCase();
    const now = Date.now();
    const hasPasscode = Boolean(dto.passcode && dto.passcode.trim().length > 0);
    const passcodeHash = hasPasscode ? this.hashPasscode(dto.passcode!) : null;

    const room: PrivateRoomState = {
      roomCode,
      hostId: dto.hostId,
      hostUsername: dto.hostUsername,
      difficulty: dto.difficulty || 'Medium',
      allowedLanguages: dto.allowedLanguages && dto.allowedLanguages.length > 0
        ? dto.allowedLanguages
        : ['typescript', 'python', 'go', 'rust'],
      timeLimitSeconds: dto.timeLimitSeconds && dto.timeLimitSeconds > 0
        ? dto.timeLimitSeconds
        : 900, // 15 mins default
      maxSpectators: dto.maxSpectators && dto.maxSpectators > 0 ? dto.maxSpectators : 50,
      passcodeHash,
      hasPasscode,
      status: 'WAITING',
      players: {
        [dto.hostId]: {
          userId: dto.hostId,
          username: dto.hostUsername,
          socketId: '',
          isReady: false,
          role: 'HOST',
          joinedAt: now,
        },
      },
      spectators: {},
      battleId: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store in-memory
    this.memoryRooms.set(roomCode, room);

    // Store in Redis hash with 1-hour expiration
    await this.persistRoomToRedis(room);

    // Persist to PostgreSQL Prisma model if available
    try {
      if (this.prisma?.privateBattleRoom?.create) {
        await this.prisma.privateBattleRoom.create({
          data: {
            roomCode,
            hostId: dto.hostId,
            difficulty: room.difficulty,
            allowedLanguages: room.allowedLanguages,
            timeLimitSeconds: room.timeLimitSeconds,
            maxSpectators: room.maxSpectators,
            passcodeHash: room.passcodeHash,
            status: room.status,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Could not persist private room to PostgreSQL: ${err?.message}`);
    }

    this.logger.log(`Created private room [${roomCode}] hosted by ${dto.hostUsername} (${dto.hostId})`);
    return room;
  }

  /**
   * Joins a private battle lobby as either a Player or a Spectator.
   * Enforces passcode validation and spectator capacity limits.
   */
  async joinPrivateRoom(dto: JoinPrivateRoomDto): Promise<{
    success: boolean;
    error?: string;
    room?: PrivateRoomState;
    role?: 'HOST' | 'PLAYER' | 'SPECTATOR';
  }> {
    const roomCode = dto.roomCode.toUpperCase();
    const room = await this.getRoom(roomCode);

    if (!room) {
      return { success: false, error: 'Private room not found or expired' };
    }

    if (room.status === 'CLOSED') {
      return { success: false, error: 'This private room is closed' };
    }

    // 1. Passcode validation
    if (room.hasPasscode && room.passcodeHash) {
      if (!dto.passcode || !this.verifyPasscode(dto.passcode, room.passcodeHash)) {
        return { success: false, error: 'Invalid room passcode' };
      }
    }

    const now = Date.now();
    const isHost = room.hostId === dto.userId;

    // 2. Spectator role request
    if (dto.role === 'spectator') {
      const spectatorCount = Object.keys(room.spectators).length;
      if (spectatorCount >= room.maxSpectators) {
        return { success: false, error: 'Spectator room is full' };
      }

      room.spectators[dto.userId] = {
        userId: dto.userId,
        username: dto.username,
        socketId: dto.socketId,
        joinedAt: now,
      };

      room.updatedAt = now;
      await this.persistRoomToRedis(room);
      return { success: true, room, role: 'SPECTATOR' };
    }

    // 3. Player role request
    if (isHost) {
      // Re-joining or updating socket for host
      room.players[dto.userId] = {
        ...room.players[dto.userId],
        socketId: dto.socketId,
        username: dto.username,
      };
      room.updatedAt = now;
      await this.persistRoomToRedis(room);
      return { success: true, room, role: 'HOST' };
    }

    // Existing player rejoining
    if (room.players[dto.userId]) {
      room.players[dto.userId].socketId = dto.socketId;
      room.players[dto.userId].username = dto.username;
      room.updatedAt = now;
      await this.persistRoomToRedis(room);
      return { success: true, room, role: room.players[dto.userId].role };
    }

    // Check if player slots are full (max 2 players in a 1v1 battle)
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 2) {
      return {
        success: false,
        error: 'Room player slots are full (2/2). You can join as a spectator.',
      };
    }

    // Add Player 2
    room.players[dto.userId] = {
      userId: dto.userId,
      username: dto.username,
      socketId: dto.socketId,
      isReady: false,
      role: 'PLAYER',
      joinedAt: now,
    };

    room.updatedAt = now;
    await this.persistRoomToRedis(room);
    return { success: true, room, role: 'PLAYER' };
  }

  /**
   * Sets player ready status and checks if all players are ready.
   */
  async setPlayerReady(
    roomCode: string,
    userId: string,
    isReady: boolean,
  ): Promise<{ room: PrivateRoomState | null; allReady: boolean }> {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);
    if (!room || !room.players[userId]) {
      return { room: null, allReady: false };
    }

    room.players[userId].isReady = isReady;
    room.updatedAt = Date.now();

    const playersList = Object.values(room.players);
    const allReady =
      playersList.length >= 2 && playersList.every((p) => p.isReady);

    if (allReady) {
      room.status = 'READY';
    } else if (room.status === 'READY') {
      room.status = 'WAITING';
    }

    await this.persistRoomToRedis(room);
    return { room, allReady };
  }

  /**
   * Starts battle match. Restricted strictly to the room HOST once both players are ready.
   */
  async startMatch(
    roomCode: string,
    callerUserId: string,
    battleId?: string,
  ): Promise<{
    success: boolean;
    error?: string;
    room?: PrivateRoomState;
    battleId?: string;
  }> {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);

    if (!room) {
      return { success: false, error: 'Private room not found' };
    }

    if (room.hostId !== callerUserId) {
      return { success: false, error: 'Only the room host can start the match' };
    }

    const playersList = Object.values(room.players);
    if (playersList.length < 2) {
      return { success: false, error: 'Need 2 players to start match' };
    }

    if (!playersList.every((p) => p.isReady)) {
      return { success: false, error: 'Both players must be ready before starting' };
    }

    const assignedBattleId = battleId || `btl_${crypto.randomUUID()}`;
    room.status = 'IN_PROGRESS';
    room.battleId = assignedBattleId;
    room.updatedAt = Date.now();

    await this.persistRoomToRedis(room);

    try {
      if (this.prisma?.privateBattleRoom?.update) {
        await this.prisma.privateBattleRoom.update({
          where: { roomCode: code },
          data: {
            status: 'IN_PROGRESS',
            battleId: assignedBattleId,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Could not update private room status in PostgreSQL: ${err?.message}`);
    }

    return { success: true, room, battleId: assignedBattleId };
  }

  /**
   * Handles player or spectator leaving or disconnecting.
   */
  async leaveRoom(
    roomCode: string,
    userId: string,
    socketId?: string,
  ): Promise<{ room: PrivateRoomState | null; wasHost: boolean; closed: boolean }> {
    const code = roomCode.toUpperCase();
    const room = await this.getRoom(code);
    if (!room) return { room: null, wasHost: false, closed: false };

    // If host leaves before match starts, close room
    if (room.hostId === userId && room.status !== 'IN_PROGRESS') {
      room.status = 'CLOSED';
      room.updatedAt = Date.now();
      await this.persistRoomToRedis(room);
      return { room, wasHost: true, closed: true };
    }

    // If player leaves
    if (room.players[userId]) {
      delete room.players[userId];
      if (room.status === 'READY') {
        room.status = 'WAITING';
      }
      room.updatedAt = Date.now();
      await this.persistRoomToRedis(room);
      return { room, wasHost: false, closed: false };
    }

    // If spectator leaves
    if (room.spectators[userId]) {
      delete room.spectators[userId];
      room.updatedAt = Date.now();
      await this.persistRoomToRedis(room);
      return { room, wasHost: false, closed: false };
    }

    return { room, wasHost: false, closed: false };
  }

  /**
   * Fetches room state from Redis hash or memory store.
   */
  async getRoom(roomCode: string): Promise<PrivateRoomState | null> {
    const code = roomCode.toUpperCase();
    const redisKey = `private_room:${code}`;

    try {
      const hashData = await this.redisService.hgetall(redisKey);
      if (hashData && Object.keys(hashData).length > 0 && hashData.roomCode) {
        const room: PrivateRoomState = {
          roomCode: hashData.roomCode,
          hostId: hashData.hostId,
          hostUsername: hashData.hostUsername,
          difficulty: (hashData.difficulty as RoomDifficulty) || 'Medium',
          allowedLanguages: hashData.allowedLanguages
            ? JSON.parse(hashData.allowedLanguages)
            : ['typescript', 'python', 'go', 'rust'],
          timeLimitSeconds: parseInt(hashData.timeLimitSeconds, 10) || 900,
          maxSpectators: parseInt(hashData.maxSpectators, 10) || 50,
          passcodeHash: hashData.passcodeHash || null,
          hasPasscode: hashData.hasPasscode === 'true',
          status: (hashData.status as RoomStatus) || 'WAITING',
          players: hashData.players ? JSON.parse(hashData.players) : {},
          spectators: hashData.spectators ? JSON.parse(hashData.spectators) : {},
          battleId: hashData.battleId || null,
          createdAt: parseInt(hashData.createdAt, 10) || Date.now(),
          updatedAt: parseInt(hashData.updatedAt, 10) || Date.now(),
        };

        this.memoryRooms.set(code, room);
        return room;
      }
    } catch (err: any) {
      this.logger.debug(`Redis getRoom failed, falling back to memory: ${err?.message}`);
    }

    return this.memoryRooms.get(code) || null;
  }

  /**
   * Returns sanitized spectator room information in read-only format.
   */
  async getSpectatorRoomInfo(roomCode: string) {
    const room = await this.getRoom(roomCode);
    if (!room) return null;

    return {
      roomCode: room.roomCode,
      status: room.status,
      difficulty: room.difficulty,
      allowedLanguages: room.allowedLanguages,
      timeLimitSeconds: room.timeLimitSeconds,
      maxSpectators: room.maxSpectators,
      spectatorCount: Object.keys(room.spectators).length,
      players: Object.values(room.players).map((p) => ({
        userId: p.userId,
        username: p.username,
        isReady: p.isReady,
        role: p.role,
      })),
      battleId: room.battleId,
    };
  }

  /**
   * Persists active room state to Redis hash with 1-hour expiration.
   */
  private async persistRoomToRedis(room: PrivateRoomState): Promise<void> {
    const redisKey = `private_room:${room.roomCode}`;
    this.memoryRooms.set(room.roomCode, room);

    try {
      const hashPayload: Record<string, string> = {
        roomCode: room.roomCode,
        hostId: room.hostId,
        hostUsername: room.hostUsername,
        difficulty: room.difficulty,
        allowedLanguages: JSON.stringify(room.allowedLanguages),
        timeLimitSeconds: room.timeLimitSeconds.toString(),
        maxSpectators: room.maxSpectators.toString(),
        passcodeHash: room.passcodeHash || '',
        hasPasscode: room.hasPasscode ? 'true' : 'false',
        status: room.status,
        players: JSON.stringify(room.players),
        spectators: JSON.stringify(room.spectators),
        battleId: room.battleId || '',
        createdAt: room.createdAt.toString(),
        updatedAt: room.updatedAt.toString(),
      };

      await this.redisService.hmset(redisKey, hashPayload);
      await this.redisService.expire(redisKey, RoomService.ROOM_TTL_SECONDS);
    } catch (err: any) {
      this.logger.debug(`Could not write room hash to Redis: ${err?.message}`);
    }
  }
}
