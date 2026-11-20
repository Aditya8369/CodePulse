import { Test, TestingModule } from '@nestjs/testing';
import { CrdtCollabGateway } from './crdt-collab.gateway';
import { CrdtCollabService } from './crdt-collab.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CrdtCollabGateway', () => {
  let gateway: CrdtCollabGateway;
  let service: CrdtCollabService;

  const mockSocket = (id: string, data: any = {}) => {
    const toEmitSpy = jest.fn();
    return {
      id,
      data,
      join: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: toEmitSpy,
      }),
      emit: jest.fn(),
      _toEmitSpy: toEmitSpy,
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      activity: {
        create: jest.fn().mockResolvedValue({ id: 'act_1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrdtCollabGateway,
        CrdtCollabService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    gateway = module.get<CrdtCollabGateway>(CrdtCollabGateway);
    service = module.get<CrdtCollabService>(CrdtCollabService);
    (gateway as any).server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('handles client join and provides initial state vector and missing updates', () => {
    const client = mockSocket('sock_1');
    const res = gateway.handleJoin(client as any, {
      docId: 'room_101',
      clientId: 1,
      userId: 'user_1',
      username: 'CoderOne',
      role: 'pair_programmer',
      stateVector: {},
    });

    expect(client.join).toHaveBeenCalledWith('room_101');
    expect(res.event).toBe('crdt:sync_step1');
    expect(res.data.docId).toBe('room_101');
    expect(res.data.participant.role).toBe('pair_programmer');
    expect(res.data.participant.mode).toBe('read-write');
    expect(client._toEmitSpy).toHaveBeenCalledWith(
      'collab:participant_joined',
      expect.objectContaining({ totalParticipants: 1 }),
    );
  });

  it('routes valid updates to peers and records state vector', () => {
    const client = mockSocket('sock_2', { docId: 'room_202', clientId: 2 });
    gateway.handleJoin(client as any, {
      docId: 'room_202',
      clientId: 2,
      username: 'CoderTwo',
      role: 'pair_programmer',
    });

    const ack = gateway.handleUpdate(client as any, {
      docId: 'room_202',
      operation: {
        docId: 'room_202',
        clientId: 2,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'K',
      },
    });

    expect(ack.status).toBe('ack');
    expect(ack.applied).toBe(true);
    expect(client._toEmitSpy).toHaveBeenCalledWith(
      'collab:update',
      expect.objectContaining({ docId: 'room_202' }),
    );
  });

  it('blocks updates from spectator mode with forbidden error', () => {
    const specClient = mockSocket('sock_spec', { docId: 'room_303', clientId: 3 });
    gateway.handleJoin(specClient as any, {
      docId: 'room_303',
      clientId: 3,
      username: 'AudienceMember',
      role: 'spectator',
    });

    const res = gateway.handleUpdate(specClient as any, {
      docId: 'room_303',
      operation: {
        docId: 'room_303',
        clientId: 3,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'X',
      },
    });

    expect(res.status).toBe('forbidden');
    expect(res.applied).toBe(false);
    expect(res.error).toContain('Forbidden');
  });

  it('routes awareness events with cursor coordinates and selections to peers', () => {
    const client = mockSocket('sock_cursor', { docId: 'room_404', clientId: 4 });
    gateway.handleJoin(client as any, {
      docId: 'room_404',
      clientId: 4,
      username: 'ActiveDev',
    });

    const res = gateway.handleAwareness(client as any, {
      docId: 'room_404',
      awareness: {
        clientId: 4,
        cursor: { line: 5, column: 10 },
        selection: { startLine: 5, startColumn: 10, endLine: 5, endColumn: 25 },
      },
    });

    expect(res.status).toBe('ok');
    expect(client._toEmitSpy).toHaveBeenCalledWith(
      'collab:awareness',
      expect.objectContaining({
        docId: 'room_404',
        awareness: expect.objectContaining({ clientId: 4 }),
      }),
    );
  });

  it('cleans up participant awareness and notifies peers on disconnect', () => {
    const client = mockSocket('sock_dc', { docId: 'room_505', clientId: 5 });
    gateway.handleJoin(client as any, {
      docId: 'room_505',
      clientId: 5,
      username: 'LeavingDev',
    });

    expect(service.getParticipants('room_505').length).toBe(1);

    gateway.handleDisconnect(client as any);

    expect(service.getParticipants('room_505').length).toBe(0);
    expect(client._toEmitSpy).toHaveBeenCalledWith(
      'collab:participant_left',
      expect.objectContaining({ clientId: 5 }),
    );
  });
});
