import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiKeyService } from './api-key.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApiKeyService (#310 Scoped Developer API Keys)', () => {
  let service: ApiKeyService;

  const mockDbKeys: any[] = [];

  const mockPrismaService = {
    apiKey: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const record = {
          id: `key-uuid-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: data.name,
          keyHash: data.keyHash,
          keyPrefix: data.keyPrefix,
          scopes: data.scopes,
          rateLimit: data.rateLimit,
          expiresAt: data.expiresAt,
          lastUsedAt: null,
          requestCount: 0,
          userId: data.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDbKeys.push(record);
        return record;
      }),
      findMany: jest.fn().mockImplementation(async ({ where, select }) => {
        let res = mockDbKeys.filter((k) => k.userId === where.userId);
        if (select) {
          res = res.map((k) => {
            const mapped: any = {};
            for (const field of Object.keys(select)) {
              if (select[field]) mapped[field] = k[field];
            }
            return mapped;
          });
        }
        return res;
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        return mockDbKeys.find((k) => k.id === where.id && k.userId === where.userId) || null;
      }),
      findUnique: jest.fn().mockImplementation(async ({ where }) => {
        const found = mockDbKeys.find((k) => k.keyHash === where.keyHash);
        if (!found) return null;
        return {
          ...found,
          user: {
            id: found.userId,
            username: 'testdev',
            email: 'dev@codepulse.io',
            organizationRole: 'DEVELOPER',
          },
        };
      }),
      delete: jest.fn().mockImplementation(async ({ where }) => {
        const idx = mockDbKeys.findIndex((k) => k.id === where.id);
        if (idx !== -1) mockDbKeys.splice(idx, 1);
        return { id: where.id };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const found = mockDbKeys.find((k) => k.id === where.id);
        if (found) {
          if (data.lastUsedAt) found.lastUsedAt = data.lastUsedAt;
          if (data.requestCount?.increment) found.requestCount += data.requestCount.increment;
        }
        return found;
      }),
    },
  };

  beforeEach(async () => {
    mockDbKeys.length = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  describe('Key Creation & Generation', () => {
    it('generates a 40+ char cryptographically secure key with cp_live_ prefix', async () => {
      const res = await service.createApiKey('user-123', {
        name: 'CI/CD Key',
        scopes: ['read:analytics', 'write:battles'],
        rateLimit: 2000,
      });

      expect(res.key).toBeDefined();
      expect(res.key.startsWith('cp_live_')).toBe(true);
      expect(res.key.length).toBeGreaterThanOrEqual(40);
      expect(res.keyPrefix).toBe(res.key.substring(0, 16));
      expect(res.scopes).toEqual(['read:analytics', 'write:battles']);
      expect(res.rateLimit).toBe(2000);

      // Verify that database only holds the SHA-256 hash, not the raw key
      expect(mockDbKeys.length).toBe(1);
      const stored = mockDbKeys[0];
      expect(stored.keyHash).not.toBe(res.key);
      const expectedHash = crypto.createHash('sha256').update(res.key).digest('hex');
      expect(stored.keyHash).toBe(expectedHash);
    });

    it('defaults to read:analytics scope and 1000 rate limit if not specified', async () => {
      const res = await service.createApiKey('user-456', {
        name: 'Default Scope Key',
      });

      expect(res.scopes).toEqual(['read:analytics']);
      expect(res.rateLimit).toBe(1000);
      expect(res.expiresAt).toBeNull();
    });

    it('handles expiration date properly', async () => {
      const exp = new Date(Date.now() + 86400000).toISOString();
      const res = await service.createApiKey('user-456', {
        name: 'Expiring Key',
        expiresAt: exp,
      });

      expect(res.expiresAt).toEqual(new Date(exp));
    });
  });

  describe('Key Listing & Masking', () => {
    it('lists keys with masked prefix and does not expose raw keys or hashes', async () => {
      await service.createApiKey('user-123', { name: 'Key 1' });
      await service.createApiKey('user-123', { name: 'Key 2' });
      await service.createApiKey('user-999', { name: 'Other User Key' });

      const list = await service.listApiKeys('user-123');
      expect(list.length).toBe(2);
      expect(list[0].name).toBe('Key 1');
      expect(list[0].keyPrefix.startsWith('cp_live_')).toBe(true);
      // Raw key and keyHash must not be present in list response
      expect((list[0] as any).key).toBeUndefined();
      expect((list[0] as any).keyHash).toBeUndefined();
    });
  });

  describe('Key Revocation', () => {
    it('revokes an existing key for the user', async () => {
      const created = await service.createApiKey('user-123', { name: 'To Revoke' });
      expect(mockDbKeys.length).toBe(1);

      const res = await service.revokeApiKey('user-123', created.id);
      expect(res.success).toBe(true);
      expect(mockDbKeys.length).toBe(0);
    });

    it('throws NotFoundException when revoking non-existent or other user key', async () => {
      const created = await service.createApiKey('user-123', { name: 'User 1 Key' });

      await expect(service.revokeApiKey('user-999', created.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Key Validation & Granular Scope Enforcement', () => {
    it('rejects invalid key formats', async () => {
      await expect(service.validateKey('')).rejects.toThrow(UnauthorizedException);
      await expect(service.validateKey('invalid_prefix_123456789012345678901234567890')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateKey('cp_live_short')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects unknown keys', async () => {
      await expect(
        service.validateKey('cp_live_9999999999999999999999999999999999999999'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired keys', async () => {
      const past = new Date(Date.now() - 60000).toISOString();
      const created = await service.createApiKey('user-123', {
        name: 'Expired Key',
        expiresAt: past,
      });

      await expect(service.validateKey(created.key)).rejects.toThrow(
        /expired/i,
      );
    });

    it('allows valid keys with matching scopes', async () => {
      const created = await service.createApiKey('user-123', {
        name: 'Analytics Key',
        scopes: ['read:analytics', 'read:leaderboard'],
      });

      const validated = await service.validateKey(created.key, ['read:analytics']);
      expect(validated.id).toBe(created.id);
      expect(validated.user.username).toBe('testdev');
    });

    it('rejects requests with insufficient scopes', async () => {
      const created = await service.createApiKey('user-123', {
        name: 'Analytics Only Key',
        scopes: ['read:analytics'],
      });

      await expect(
        service.validateKey(created.key, ['read:analytics', 'write:battles']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('wildcard scopes (* and admin:*) satisfy all requested permissions', async () => {
      const createdWildcard = await service.createApiKey('user-123', {
        name: 'Admin Wildcard Key',
        scopes: ['*'],
      });

      const validated = await service.validateKey(createdWildcard.key, [
        'read:analytics',
        'write:battles',
        'admin:sync',
      ]);
      expect(validated.id).toBe(createdWildcard.id);
    });

    it('triggers asynchronous metric update for lastUsedAt and requestCount', async () => {
      const created = await service.createApiKey('user-123', {
        name: 'Counter Key',
        scopes: ['read:analytics'],
      });

      await service.validateKey(created.key);
      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: created.id },
          data: expect.objectContaining({
            requestCount: { increment: 1 },
          }),
        }),
      );
    });
  });
});
