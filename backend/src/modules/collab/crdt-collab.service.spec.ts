import { Test, TestingModule } from '@nestjs/testing';
import { CrdtCollabService, CrdtBinaryUpdate } from './crdt-collab.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CrdtCollabService', () => {
  let service: CrdtCollabService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      activity: {
        create: jest.fn().mockResolvedValue({ id: 'act_1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrdtCollabService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CrdtCollabService>(CrdtCollabService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('Deterministic CRDT Convergence & Zero Character Loss', () => {
    it('should converge to identical text regardless of operation arrival order (Commutative)', () => {
      const doc1 = 'session_order_1';
      const doc2 = 'session_order_2';

      service.joinSession(doc1, { clientId: 1, userId: 'u1', username: 'Dev1', color: '#f00' });
      service.joinSession(doc1, { clientId: 2, userId: 'u2', username: 'Dev2', color: '#0f0' });

      service.joinSession(doc2, { clientId: 1, userId: 'u1', username: 'Dev1', color: '#f00' });
      service.joinSession(doc2, { clientId: 2, userId: 'u2', username: 'Dev2', color: '#0f0' });

      const opA: Omit<CrdtBinaryUpdate, 'id' | 'timestamp'> = {
        docId: doc1,
        clientId: 1,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'H',
      };

      const opB: Omit<CrdtBinaryUpdate, 'id' | 'timestamp'> = {
        docId: doc1,
        clientId: 2,
        clock: 1,
        type: 'insert',
        position: 1,
        char: 'i',
      };

      // Doc 1 receives A then B
      service.applyUpdate(doc1, 1, opA);
      service.applyUpdate(doc1, 2, opB);

      // Doc 2 receives B then A
      service.applyUpdate(doc2, 2, opB);
      service.applyUpdate(doc2, 1, opA);

      const state1 = service.getOrCreateSession(doc1);
      const state2 = service.getOrCreateSession(doc2);

      expect(state1.content).toBe(state2.content);
      expect(state1.content).toBe('Hi');
    });

    it('resolves simultaneous conflicting keystrokes deterministically with 0 character loss', () => {
      const docId = 'doc_conflict';
      service.joinSession(docId, { clientId: 1, userId: 'u1', username: 'Alice', color: '#f00' });
      service.joinSession(docId, { clientId: 2, userId: 'u2', username: 'Bob', color: '#00f' });

      // Alice and Bob both type at position 0 with identical clock
      const aliceOp = { docId, clientId: 1, clock: 1, type: 'insert' as const, position: 0, char: 'A' };
      const bobOp = { docId, clientId: 2, clock: 1, type: 'insert' as const, position: 0, char: 'B' };

      service.applyUpdate(docId, 1, aliceOp);
      service.applyUpdate(docId, 2, bobOp);

      const session = service.getOrCreateSession(docId);
      // Both characters must be preserved without loss
      expect(session.content.length).toBe(2);
      expect(session.content).toContain('A');
      expect(session.content).toContain('B');
      expect(session.operations.length).toBe(2);
    });

    it('should be idempotent and ignore duplicate updates', () => {
      const docId = 'doc_idempotent';
      service.joinSession(docId, { clientId: 1, userId: 'u1', username: 'Dev1', color: '#f00' });

      const op = { docId, clientId: 1, clock: 1, type: 'insert' as const, position: 0, char: 'X' };

      const res1 = service.applyUpdate(docId, 1, op);
      expect(res1.applied).toBe(true);

      const res2 = service.applyUpdate(docId, 1, op);
      expect(res2.applied).toBe(false);

      const session = service.getOrCreateSession(docId);
      expect(session.content).toBe('X');
      expect(session.operations.length).toBe(1);
    });
  });

  describe('Room Permission Controls (Pair Programming vs Spectator Mode)', () => {
    it('allows pair programmers and editors to write, but blocks read-only spectators', () => {
      const docId = 'doc_permissions';

      service.joinSession(docId, {
        clientId: 1,
        userId: 'dev1',
        username: 'PairDev',
        color: '#3b82f6',
        role: 'pair_programmer',
      });

      service.joinSession(docId, {
        clientId: 2,
        userId: 'spec1',
        username: 'SpectatorFan',
        color: '#9ca3af',
        role: 'spectator',
      });

      // Pair programmer edit succeeds
      const editDev = service.applyUpdate(docId, 1, {
        docId,
        clientId: 1,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'const a = 1;',
      });
      expect(editDev.applied).toBe(true);
      expect(editDev.session.content).toBe('const a = 1;');

      // Spectator edit is rejected with forbidden error
      const editSpec = service.applyUpdate(docId, 2, {
        docId,
        clientId: 2,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'malicious',
      });
      expect(editSpec.applied).toBe(false);
      expect(editSpec.error).toContain('Forbidden');
      expect(editSpec.session.content).toBe('const a = 1;');
    });

    it('allows dynamic promotion and demotion of participant roles', () => {
      const docId = 'doc_roles';
      service.joinSession(docId, {
        clientId: 3,
        userId: 'spec_to_dev',
        username: 'Guest',
        color: '#8b5cf6',
        role: 'spectator',
      });

      const updated = service.setParticipantRole(docId, 3, 'pair_programmer');
      expect(updated?.role).toBe('pair_programmer');
      expect(updated?.mode).toBe('read-write');

      // Now participant can write
      const edit = service.applyUpdate(docId, 3, {
        docId,
        clientId: 3,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'let valid = true;',
      });
      expect(edit.applied).toBe(true);
    });
  });

  describe('Awareness & Multi-Cursor Synchronization', () => {
    it('tracks cursor coordinates, text selections, and user color avatars', () => {
      const docId = 'doc_awareness';
      service.joinSession(docId, {
        clientId: 1,
        userId: 'u1',
        username: 'Alice',
        color: '#ef4444',
      });

      const peers = service.updateAwareness(docId, {
        clientId: 1,
        cursor: { line: 12, column: 8 },
        selection: { startLine: 12, startColumn: 8, endLine: 12, endColumn: 20 },
      });

      expect(peers.length).toBe(1);
      expect(peers[0].cursor).toEqual({ line: 12, column: 8 });
      expect(peers[0].selection).toEqual({ startLine: 12, startColumn: 8, endLine: 12, endColumn: 20 });
      expect(peers[0].color).toBe('#ef4444');
    });

    it('removes participant upon disconnect', () => {
      const docId = 'doc_disconnect';
      service.joinSession(docId, { clientId: 1, userId: 'u1', username: 'P1', color: '#10b981' });
      service.joinSession(docId, { clientId: 2, userId: 'u2', username: 'P2', color: '#3b82f6' });

      expect(service.getParticipants(docId).length).toBe(2);

      const removed = service.removeParticipant(docId, 1);
      expect(removed?.clientId).toBe(1);
      expect(service.getParticipants(docId).length).toBe(1);
    });
  });

  describe('Binary Updates & Redis Checkpointing & PostgreSQL Persistence', () => {
    it('encodes and decodes binary CRDT updates with sub-80 byte overhead', () => {
      const updates: CrdtBinaryUpdate[] = [
        {
          id: '1:1',
          docId: 'doc_bin',
          clientId: 1,
          clock: 1,
          type: 'insert',
          position: 0,
          char: 'A',
          timestamp: Date.now(),
        },
      ];

      const binaryBuffer = service.encodeStateAsBinaryUpdate(updates);
      expect(binaryBuffer.length).toBeLessThan(80);

      const decoded = service.decodeBinaryUpdate(binaryBuffer, 'doc_bin');
      expect(decoded.length).toBe(1);
      expect(decoded[0].char).toBe('A');
      expect(decoded[0].clientId).toBe(1);
    });

    it('persists checkpoints to in-memory/Redis store every 10 seconds', async () => {
      const docId = 'doc_checkpoint';
      service.joinSession(docId, { clientId: 1, userId: 'u1', username: 'P1', color: '#10b981' });

      service.applyUpdate(docId, 1, {
        docId,
        clientId: 1,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'function battle() {}',
      });

      // Force last checkpoint timestamp to 11s ago
      const session = service.getOrCreateSession(docId);
      session.lastCheckpointMs = Date.now() - 11000;

      const persistedCount = await service.persistCheckpointsToRedis();
      expect(persistedCount).toBeGreaterThanOrEqual(1);

      const checkpoint = await service.getLatestCheckpoint(docId);
      expect(checkpoint).toBeTruthy();
    });

    it('finalizes session and persists final code to PostgreSQL upon completion', async () => {
      const docId = 'doc_final';
      service.joinSession(docId, { clientId: 1, userId: 'u1', username: 'P1', color: '#10b981' });

      service.applyUpdate(docId, 1, {
        docId,
        clientId: 1,
        clock: 1,
        type: 'insert',
        position: 0,
        char: 'export const win = () => true;',
      });

      const res = await service.saveFinalCode(docId);
      expect(res.docId).toBe(docId);
      expect(res.finalCode).toBe('export const win = () => true;');
      expect(res.persisted).toBe(true);
      expect(mockPrisma.activity.create).toHaveBeenCalled();

      // Once finished, session cannot receive further edits
      const lateEdit = service.applyUpdate(docId, 1, {
        docId,
        clientId: 1,
        clock: 2,
        type: 'insert',
        position: 0,
        char: 'late',
      });
      expect(lateEdit.applied).toBe(false);
      expect(lateEdit.error).toContain('finished');
    });
  });
});
