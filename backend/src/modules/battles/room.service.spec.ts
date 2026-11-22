import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BattlesGateway } from './battles.gateway';
import { MetricsService } from '../metrics/metrics.service';

describe('RoomService & BattlesGateway Private Lobbies Suite (#316)', () => {
  let roomService: RoomService;
  let redisService: RedisService;
  let prismaMock: any;
  let gateway: BattlesGateway;
  let mockServer: any;

  beforeEach(async () => {
    prismaMock = {
      privateBattleRoom: {
        create: jest.fn().mockResolvedValue({ id: 'pbr-1' }),
        update: jest.fn().mockResolvedValue({ id: 'pbr-1' }),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        RedisService,
        { provide: PrismaService, useValue: prismaMock },
        BattlesGateway,
        {
          provide: MetricsService,
          useValue: {
            socketConnected: jest.fn(),
            socketDisconnected: jest.fn(),
          },
        },
      ],
    }).compile();

    roomService = module.get<RoomService>(RoomService);
    redisService = module.get<RedisService>(RedisService);
    gateway = module.get<BattlesGateway>(BattlesGateway);

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
      },
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    redisService.clearMemoryStores();
    gateway.onModuleDestroy();
  });

  describe('Room Code & Passcode Cryptography', () => {
    it('generates 6-character alphanumeric room code formatted with BTL prefix', () => {
      const code = roomService.generateRoomCode();
      expect(code).toMatch(/^BTL-[2-9A-Z]{3}$/);
    });

    it('cryptographically hashes passcodes and verifies matches accurately', () => {
      const raw = 'secretPass123';
      const hash = roomService.hashPasscode(raw);

      expect(hash).toHaveLength(64); // SHA-256 hex string
      expect(roomService.verifyPasscode(raw, hash)).toBe(true);
      expect(roomService.verifyPasscode('wrongPass', hash)).toBe(false);
    });
  });

  describe('Private Room Creation with Custom Rulesets & Redis Hashes', () => {
    it('creates private room with custom parameters and 1-hour Redis expiration', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-1',
        hostUsername: 'CodeMaster',
        difficulty: 'Hard',
        allowedLanguages: ['typescript', 'rust'],
        timeLimitSeconds: 1800, // 30 minutes
        maxSpectators: 20,
        passcode: 'nexus2026',
      });

      expect(room.roomCode).toBeDefined();
      expect(room.hostId).toBe('host-1');
      expect(room.difficulty).toBe('Hard');
      expect(room.allowedLanguages).toEqual(['typescript', 'rust']);
      expect(room.timeLimitSeconds).toBe(1800);
      expect(room.maxSpectators).toBe(20);
      expect(room.hasPasscode).toBe(true);
      expect(room.passcodeHash).toBeDefined();
      expect(room.status).toBe('WAITING');
      expect(room.players['host-1'].role).toBe('HOST');

      // Verify Redis hash persistence
      const redisData = await redisService.hgetall(`private_room:${room.roomCode}`);
      expect(redisData.roomCode).toBe(room.roomCode);
      expect(redisData.difficulty).toBe('Hard');
      expect(redisData.hasPasscode).toBe('true');

      // Verify 1-hour expiration
      const ttl = await redisService.ttl(`private_room:${room.roomCode}`);
      expect(ttl).toBeGreaterThan(3500);
    });

    it('falls back to default ruleset when optional parameters are omitted', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-2',
        hostUsername: 'JuniorDev',
      });

      expect(room.difficulty).toBe('Medium');
      expect(room.allowedLanguages).toEqual(['typescript', 'python', 'go', 'rust']);
      expect(room.timeLimitSeconds).toBe(900);
      expect(room.maxSpectators).toBe(50);
      expect(room.hasPasscode).toBe(false);
      expect(room.passcodeHash).toBeNull();
    });
  });

  describe('Passcode Protection & Join Validation', () => {
    it('rejects join attempts when passcode is missing or invalid', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-3',
        hostUsername: 'Alice',
        passcode: 'topSecret99',
      });

      // Attempt 1: No passcode
      const res1 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'user-b',
        username: 'Bob',
        socketId: 'sock-b',
      });
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('Invalid room passcode');

      // Attempt 2: Incorrect passcode
      const res2 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'user-b',
        username: 'Bob',
        socketId: 'sock-b',
        passcode: 'wrongPassword',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Invalid room passcode');

      // Attempt 3: Correct passcode
      const res3 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'user-b',
        username: 'Bob',
        socketId: 'sock-b',
        passcode: 'topSecret99',
      });
      expect(res3.success).toBe(true);
      expect(res3.role).toBe('PLAYER');
    });

    it('rejects player join when 2 player slots are already filled', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-p1',
        hostUsername: 'Player1',
      });

      await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'player-2',
        username: 'Player2',
        socketId: 'sock-p2',
      });

      // Attempt 3rd player
      const res = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'player-3',
        username: 'Player3',
        socketId: 'sock-p3',
        role: 'player',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Room player slots are full');
    });
  });

  describe('Spectator Role & Capacity Management', () => {
    it('allows spectators to join and enforces maxSpectators ceiling', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-stream',
        hostUsername: 'StreamHost',
        maxSpectators: 2,
      });

      const spec1 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'spec-1',
        username: 'Viewer1',
        socketId: 'sock-s1',
        role: 'spectator',
      });
      expect(spec1.success).toBe(true);
      expect(spec1.role).toBe('SPECTATOR');

      const spec2 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'spec-2',
        username: 'Viewer2',
        socketId: 'sock-s2',
        role: 'spectator',
      });
      expect(spec2.success).toBe(true);
      expect(spec2.role).toBe('SPECTATOR');

      // 3rd spectator exceeds capacity
      const spec3 = await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'spec-3',
        username: 'Viewer3',
        socketId: 'sock-s3',
        role: 'spectator',
      });
      expect(spec3.success).toBe(false);
      expect(spec3.error).toContain('Spectator room is full');
    });
  });

  describe('Match Lifecycle: Ready Up, Start Match & Graceful Leave', () => {
    it('handles player ready state transitions and signals allReady', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'h1',
        hostUsername: 'H1',
      });

      await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'p2',
        username: 'P2',
        socketId: 'sock-p2',
      });

      // Host ready
      const ready1 = await roomService.setPlayerReady(room.roomCode, 'h1', true);
      expect(ready1.allReady).toBe(false);

      // Player 2 ready -> all ready!
      const ready2 = await roomService.setPlayerReady(room.roomCode, 'p2', true);
      expect(ready2.allReady).toBe(true);
      expect(ready2.room?.status).toBe('READY');
    });

    it('enforces that only host can start match and only when all players are ready', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'h1',
        hostUsername: 'H1',
      });

      await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'p2',
        username: 'P2',
        socketId: 'sock-p2',
      });

      // Non-host attempts to start
      const startFail1 = await roomService.startMatch(room.roomCode, 'p2');
      expect(startFail1.success).toBe(false);
      expect(startFail1.error).toContain('Only the room host can start');

      // Host attempts to start before ready
      const startFail2 = await roomService.startMatch(room.roomCode, 'h1');
      expect(startFail2.success).toBe(false);
      expect(startFail2.error).toContain('Both players must be ready');

      // Ready both players
      await roomService.setPlayerReady(room.roomCode, 'h1', true);
      await roomService.setPlayerReady(room.roomCode, 'p2', true);

      // Host starts match
      const startSuccess = await roomService.startMatch(room.roomCode, 'h1');
      expect(startSuccess.success).toBe(true);
      expect(startSuccess.room?.status).toBe('IN_PROGRESS');
      expect(startSuccess.battleId).toBeDefined();
    });

    it('closes room gracefully when host leaves before match starts', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-leaving',
        hostUsername: 'Leaver',
      });

      const leaveRes = await roomService.leaveRoom(room.roomCode, 'host-leaving');
      expect(leaveRes.closed).toBe(true);
      expect(leaveRes.room?.status).toBe('CLOSED');
    });
  });

  describe('BattlesGateway WebSocket Events Suite', () => {
    it('handles room:create_private and emits room:created with shareable link', async () => {
      const mockClient: any = {
        id: 'host-sock-1',
        join: jest.fn().mockResolvedValue(true),
        emit: jest.fn(),
      };

      const res = await gateway.handleCreatePrivateRoom(mockClient, {
        hostId: 'u-101',
        hostUsername: 'Alpha',
        difficulty: 'Easy',
        allowedLanguages: ['typescript'],
        timeLimitSeconds: 300,
      });

      expect(res?.roomCode).toBeDefined();
      expect(res?.shareableLink).toContain('/battles/private/');
      expect(mockClient.join).toHaveBeenCalledWith(`room:${res?.roomCode}`);
      expect(mockClient.emit).toHaveBeenCalledWith(
        'room:created',
        expect.objectContaining({ roomCode: res?.roomCode }),
      );
    });

    it('handles room:join_private for player and broadcasts room:player_joined', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-gw',
        hostUsername: 'HostGW',
      });

      const mockClient: any = {
        id: 'player-sock-gw',
        join: jest.fn().mockResolvedValue(true),
        emit: jest.fn(),
      };

      const res = await gateway.handleJoinPrivateRoom(mockClient, {
        roomCode: room.roomCode,
        userId: 'player-gw',
        username: 'PlayerGW',
        role: 'player',
      });

      expect(res.success).toBe(true);
      expect(res.role).toBe('PLAYER');
      expect(mockClient.join).toHaveBeenCalledWith(`room:${room.roomCode}`);
      expect(mockServer.to).toHaveBeenCalledWith(`room:${room.roomCode}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'room:player_joined',
        expect.objectContaining({ roomCode: room.roomCode }),
      );
    });

    it('handles room:join_private for spectator and streams read-only updates', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'host-spec-gw',
        hostUsername: 'HostSpecGW',
      });

      const mockClient: any = {
        id: 'spectator-sock-gw',
        join: jest.fn().mockResolvedValue(true),
        emit: jest.fn(),
      };

      const res = await gateway.handleJoinPrivateRoom(mockClient, {
        roomCode: room.roomCode,
        userId: 'spec-user-gw',
        username: 'SpectatorUser',
        role: 'spectator',
      });

      expect(res.success).toBe(true);
      expect(res.role).toBe('SPECTATOR');
      expect(mockClient.join).toHaveBeenCalledWith(`spectator:${room.roomCode}`);
      expect(gateway.isSocketSpectator('spectator-sock-gw')).toBe(true);
    });

    it('rejects keystrokes from sockets marked with spectator role', () => {
      const mockClient: any = {
        id: 'spectator-blocked-sock',
        emit: jest.fn(),
      };

      (gateway as any).socketRoles.set('spectator-blocked-sock', { role: 'SPECTATOR' });

      gateway.handleKeystroke(mockClient, {
        battleId: 'b-999',
        userId: 'spec-intruder',
        delta: 'console.log("hacked")',
      });

      expect(mockClient.emit).toHaveBeenCalledWith('error', {
        message: 'Spectators are read-only and cannot send keystrokes',
      });
    });

    it('handles room:player_ready and emits room:all_ready when both ready', async () => {
      const room = await roomService.createPrivateRoom({
        hostId: 'h-ready',
        hostUsername: 'HReady',
      });

      await roomService.joinPrivateRoom({
        roomCode: room.roomCode,
        userId: 'p-ready',
        username: 'PReady',
        socketId: 'sock-p-ready',
      });

      const mockClient: any = { id: 'sock-h-ready' };

      await gateway.handleRoomPlayerReady(mockClient, {
        roomCode: room.roomCode,
        userId: 'h-ready',
        isReady: true,
      });

      await gateway.handleRoomPlayerReady(mockClient, {
        roomCode: room.roomCode,
        userId: 'p-ready',
        isReady: true,
      });

      expect(mockServer.to).toHaveBeenCalledWith(`room:${room.roomCode}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'room:all_ready',
        expect.objectContaining({ readyToStart: true }),
      );
    });
  });
});
