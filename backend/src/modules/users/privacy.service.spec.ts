import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivacyService } from './privacy.service';

describe('PrivacyService - GDPR Cryptographic Shredding Pipeline (#394)', () => {
  let service: PrivacyService;
  let prismaService: any;
  let redisService: any;

  const mockUser = {
    id: 'user-uuid-1234',
    username: 'cryptodev',
    email: 'dev@cryptomail.com',
    authEmail: 'dev@cryptomail.com',
    name: 'Satoshi Nakamoto',
    avatar: 'https://cdn.codepulse.dev/avatars/satoshi.png',
    bio: 'Distributed systems architect',
    location: 'Zurich, Switzerland',
    company: 'Nexus Cybernetics',
    website: 'https://nexus.dev',
    githubUrl: 'https://github.com/cryptodev',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    twoFactorEnabled: true,
    twoFactorBackupCodes: ['12345678', '87654321'],
    isAnonymized: false,
    anonymizedAt: null,
    deletedAt: null,
    refreshTokens: [{ id: 'rt-1' }, { id: 'rt-2' }],
    passwordResetTokens: [{ id: 'prt-1' }],
    apiKeys: [{ id: 'key-1' }, { id: 'key-2' }],
    battlesAsChallenger: [
      { id: 'battle-1', opponentId: 'user-opp-1', winnerId: 'user-uuid-1234' },
      { id: 'battle-2', opponentId: 'user-opp-2', winnerId: 'user-opp-2' },
    ],
    battlesAsOpponent: [
      { id: 'battle-3', challengerId: 'user-opp-3', winnerId: 'user-opp-3' },
    ],
  };

  const mockBattles = [
    { id: 'battle-1', challengerId: 'user-uuid-1234', opponentId: 'user-opp-1', winnerId: 'user-uuid-1234' },
    { id: 'battle-2', challengerId: 'user-uuid-1234', opponentId: 'user-opp-2', winnerId: 'user-opp-2' },
    { id: 'battle-3', challengerId: 'user-opp-3', opponentId: 'user-uuid-1234', winnerId: 'user-opp-3' },
  ];

  beforeEach(async () => {
    const mockTx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data })),
      },
      refreshToken: {
        count: jest.fn().mockResolvedValue(2),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      passwordResetToken: {
        count: jest.fn().mockResolvedValue(1),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      apiKey: {
        count: jest.fn().mockResolvedValue(2),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      signalPreKeyBundle: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        count: jest.fn().mockResolvedValue(10),
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      },
      notificationOutbox: {
        count: jest.fn().mockResolvedValue(3),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      activity: {
        count: jest.fn().mockResolvedValue(25),
        deleteMany: jest.fn().mockResolvedValue({ count: 25 }),
      },
      userSettings: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      follows: {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      auditLog: {
        count: jest.fn().mockResolvedValue(4),
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      battle: {
        findMany: jest.fn().mockResolvedValue(mockBattles),
      },
      gdprDeletionCertificate: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'cert-uuid-777',
            ...data,
          }),
        ),
      },
    };

    prismaService = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockUser.id || where.username === mockUser.username) {
            return Promise.resolve({ ...mockUser });
          }
          return Promise.resolve(null);
        }),
      },
      gdprDeletionCertificate: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve({
            id: 'cert-uuid-777',
            certificateNumber: 'GDPR-RTBF-2026-A1B2C3D4',
            userId: mockUser.id,
            anonymizedHandle: 'Ghost-Dev-8392',
            shreddedAt: new Date('2026-11-22T23:00:00.000Z'),
            reason: 'User requested Right-to-be-Forgotten under GDPR Article 17',
            sha256Signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            purgedCategories: {
              pii: ['username', 'email', 'name'],
            },
            metadata: {
              refreshTokensPurged: 2,
              apiKeysPurged: 2,
              auditLogsPurged: 4,
            },
            exportableToken: Buffer.from(
              JSON.stringify({
                certificateNumber: 'GDPR-RTBF-2026-A1B2C3D4',
                userId: mockUser.id,
                anonymizedHandle: 'Ghost-Dev-8392',
                executedAt: '2026-11-22T23:00:00.000Z',
                sha256Signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              }),
            ).toString('base64'),
          });
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      }),
    };

    redisService = {
      delPattern: jest.fn().mockResolvedValue(5),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
  });

  describe('previewShred', () => {
    it('should return accurate counts of credentials, tokens, and preserved historical battles', async () => {
      const preview = await service.previewShred(mockUser.id);

      expect(preview.userId).toBe(mockUser.id);
      expect(preview.currentUsername).toBe('cryptodev');
      expect(preview.currentEmail).toBe('dev@cryptomail.com');
      expect(preview.anonymizedHandlePlaceholder).toMatch(/^Ghost-Dev-\d{4}$/);
      expect(preview.tokensToPurgeCount.refreshTokens).toBe(2);
      expect(preview.tokensToPurgeCount.passwordResetTokens).toBe(1);
      expect(preview.tokensToPurgeCount.apiKeys).toBe(2);
      expect(preview.historicalBattlesPreservedCount).toBe(3);
      expect(preview.piiFieldsToShred).toContain('username');
      expect(preview.piiFieldsToShred).toContain('email');
      expect(preview.piiFieldsToShred).toContain('passwordHash');
    });

    it('should throw NotFoundException if user is not found', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.previewShred('non-existent-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is already shredded', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isAnonymized: true,
      });

      await expect(service.previewShred(mockUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('shredUserAccount', () => {
    it('should reject deletion when confirmUsername does not match', async () => {
      await expect(
        service.shredUserAccount(mockUser.id, { confirmUsername: 'wrongusername' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should execute cryptographic erasure and purge PII inside an atomic transaction', async () => {
      const certificate = await service.shredUserAccount(mockUser.id, {
        confirmUsername: 'cryptodev',
        reason: 'GDPR Right-to-be-Forgotten request',
      });

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

      // Verify certificate structure
      expect(certificate.certificateNumber).toMatch(/^GDPR-RTBF-\d{4}-[0-9A-F]{8}$/);
      expect(certificate.anonymizedHandle).toMatch(/^Ghost-Dev-\d+$/);
      expect(certificate.status).toBe('CRYPTOGRAPHICALLY_SHREDDED');
      expect(certificate.legalBasis).toBe('GDPR Article 17 - Right to Erasure');

      // Verify summary of purged items
      expect(certificate.summary.refreshTokensPurged).toBe(2);
      expect(certificate.summary.passwordResetTokensPurged).toBe(1);
      expect(certificate.summary.apiKeysPurged).toBe(2);
      expect(certificate.summary.activitiesPurged).toBe(25);
      expect(certificate.summary.auditLogsPurged).toBe(4);
      expect(certificate.summary.redisKeysInvalidated).toBeGreaterThan(0);

      // Verify cryptographic signature
      expect(certificate.sha256Signature).toBeDefined();
      expect(certificate.sha256Signature).toHaveLength(64);
      expect(certificate.exportableToken).toBeDefined();

      // Verify Redis cache invalidation was triggered across keys
      expect(redisService.delPattern).toHaveBeenCalledWith(
        expect.stringContaining(`user:${mockUser.id}`),
      );
      expect(redisService.delPattern).toHaveBeenCalledWith(
        expect.stringContaining(`session:${mockUser.id}`),
      );
      expect(redisService.delPattern).toHaveBeenCalledWith(
        expect.stringContaining(`user:cryptodev`),
      );
    });

    it('should prevent repeated shredding on already anonymized accounts', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        isAnonymized: true,
      });

      await expect(
        service.shredUserAccount(mockUser.id, { confirmUsername: 'cryptodev' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDeletionCertificate', () => {
    it('should retrieve certificate by certificateNumber or id', async () => {
      const cert = await service.getDeletionCertificate('GDPR-RTBF-2026-A1B2C3D4');

      expect(cert.certificateNumber).toBe('GDPR-RTBF-2026-A1B2C3D4');
      expect(cert.anonymizedHandle).toBe('Ghost-Dev-8392');
      expect(cert.sha256Signature).toBeDefined();
    });

    it('should throw NotFoundException when certificate does not exist', async () => {
      prismaService.gdprDeletionCertificate.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getDeletionCertificate('NON-EXISTENT-CERT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyCertificate', () => {
    it('should verify certificate validity with certificateNumber', async () => {
      const result = await service.verifyCertificate({
        certificateNumber: 'GDPR-RTBF-2026-A1B2C3D4',
      });

      expect(result.isValid).toBe(true);
      expect(result.certificateNumber).toBe('GDPR-RTBF-2026-A1B2C3D4');
      expect(result.anonymizedHandle).toBe('Ghost-Dev-8392');
    });

    it('should verify certificate validity using exportable Base64 token', async () => {
      const token = Buffer.from(
        JSON.stringify({
          certificateNumber: 'GDPR-RTBF-2026-A1B2C3D4',
        }),
      ).toString('base64');

      const result = await service.verifyCertificate({
        exportableToken: token,
      });

      expect(result.isValid).toBe(true);
      expect(result.certificateNumber).toBe('GDPR-RTBF-2026-A1B2C3D4');
    });

    it('should return invalid status for non-existent certificate', async () => {
      prismaService.gdprDeletionCertificate.findFirst.mockResolvedValueOnce(null);

      const result = await service.verifyCertificate({
        certificateNumber: 'GDPR-FAKE-1234',
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('No matching cryptographic shredding certificate');
    });
  });
});

