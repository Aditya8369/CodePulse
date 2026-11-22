import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLogService (#313 Immutable Security Audit Log Trail)', () => {
  let service: AuditLogService;

  const mockDbLogs: any[] = [];

  const mockPrismaService = {
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const record = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          actorId: data.actorId || null,
          actorEmail: data.actorEmail || null,
          action: data.action,
          targetId: data.targetId || null,
          targetType: data.targetType || 'SYSTEM',
          metadata: data.metadata || null,
          ipAddress: data.ipAddress || '127.0.0.1',
          userAgent: data.userAgent || null,
          createdAt: new Date(),
        };
        mockDbLogs.push(record);
        return record;
      }),
      findMany: jest.fn().mockImplementation(async ({ where, skip, take }) => {
        let results = [...mockDbLogs];

        if (where?.action) {
          results = results.filter((l) => l.action === where.action);
        }
        if (where?.actorId) {
          results = results.filter((l) => l.actorId === where.actorId);
        }
        if (where?.targetId) {
          results = results.filter((l) => l.targetId === where.targetId);
        }
        if (where?.targetType) {
          results = results.filter((l) => l.targetType === where.targetType);
        }
        if (where?.createdAt?.gte) {
          results = results.filter((l) => l.createdAt >= where.createdAt.gte);
        }
        if (where?.createdAt?.lte) {
          results = results.filter((l) => l.createdAt <= where.createdAt.lte);
        }

        const start = skip || 0;
        const end = take ? start + take : undefined;
        return results.slice(start, end);
      }),
      count: jest.fn().mockImplementation(async ({ where }) => {
        let results = [...mockDbLogs];
        if (where?.action) results = results.filter((l) => l.action === where.action);
        if (where?.actorId) results = results.filter((l) => l.actorId === where.actorId);
        if (where?.targetId) results = results.filter((l) => l.targetId === where.targetId);
        return results.length;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        return mockDbLogs.find((l) => l.id === where.id) || null;
      }),
    },
  };

  beforeEach(async () => {
    mockDbLogs.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe('Append-Only Audit Logging', () => {
    it('creates structured immutable audit log entries with masked sensitive fields', async () => {
      const entry = await service.logAction({
        actorId: 'admin-123',
        actorEmail: 'security@codepulse.dev',
        action: 'ROLE_CHANGED',
        targetId: 'user-456',
        targetType: 'USER',
        metadata: {
          previousRole: 'DEVELOPER',
          newRole: 'MAINTAINER',
          adminPassword: 'supersecretpassword123',
          apiSecretKey: 'sk_live_secret123',
        },
        ipAddress: '198.51.100.42',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      });

      expect(entry.id).toBeDefined();
      expect(entry.action).toBe('ROLE_CHANGED');
      expect(entry.actorId).toBe('admin-123');
      expect(entry.actorEmail).toBe('security@codepulse.dev');
      expect(entry.targetId).toBe('user-456');
      expect(entry.targetType).toBe('USER');
      expect(entry.ipAddress).toBe('198.51.100.42');

      // Sensitive fields must be masked/redacted in metadata
      expect(entry.metadata.adminPassword).toBe('[REDACTED]');
      expect(entry.metadata.apiSecretKey).toBe('[REDACTED]');
      expect(entry.metadata.previousRole).toBe('DEVELOPER');
      expect(entry.metadata.newRole).toBe('MAINTAINER');
    });

    it('supports legacy positional arguments for backward compatibility', async () => {
      const entry = await service.logAction(
        'actor-legacy',
        'MAINTENANCE_TOGGLED',
        'SYSTEM',
        'sys-1',
        { enabled: true },
        '10.0.0.1',
      );

      expect(entry.actorId).toBe('actor-legacy');
      expect(entry.action).toBe('MAINTENANCE_TOGGLED');
      expect(entry.targetType).toBe('SYSTEM');
      expect(entry.targetResource).toBe('SYSTEM');
    });
  });

  describe('Strict Immutability Controls', () => {
    it('strictly forbids UPDATE operations on audit log records', async () => {
      await expect(service.updateAuditLog()).rejects.toThrow(ForbiddenException);
    });

    it('strictly forbids DELETE operations on audit log records', async () => {
      await expect(service.deleteAuditLog()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Paginated Multi-Dimensional Filtering', () => {
    beforeEach(async () => {
      await service.logAction({
        actorId: 'admin-1',
        action: 'USER_BANNED',
        targetId: 'cheater-99',
        targetType: 'USER',
      });
      await service.logAction({
        actorId: 'admin-1',
        action: 'USER_UNLOCKED',
        targetId: 'dev-1',
        targetType: 'USER',
      });
      await service.logAction({
        actorId: 'admin-2',
        action: 'MAINTENANCE_TOGGLED',
        targetId: 'core-system',
        targetType: 'SYSTEM',
      });
    });

    it('filters audit logs by action', async () => {
      const result = await service.getAuditLogs({ action: 'USER_BANNED' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].action).toBe('USER_BANNED');
      expect(result.data[0].targetId).toBe('cheater-99');
    });

    it('filters audit logs by actorId', async () => {
      const result = await service.getAuditLogs({ actorId: 'admin-1' });
      expect(result.data.length).toBe(2);
    });

    it('filters audit logs by targetId', async () => {
      const result = await service.getAuditLogs({ targetId: 'core-system' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].action).toBe('MAINTENANCE_TOGGLED');
    });

    it('supports pagination with total and page metadata', async () => {
      const result = await service.getAuditLogs({ page: 1, limit: 2 });
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('retrieves single audit record by ID and throws 404 if not found', async () => {
      const created = await service.logAction({
        action: 'XP_ADJUSTED',
        targetId: 'user-77',
      });

      const found = await service.getAuditLogById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.action).toBe('XP_ADJUSTED');

      await expect(service.getAuditLogById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
