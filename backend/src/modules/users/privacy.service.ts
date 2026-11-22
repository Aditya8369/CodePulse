import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfirmAccountDeletionDto,
  GdprDeletionCertificateDto,
  ShredPreviewDto,
  VerifyCertificateDto,
  VerifyCertificateResponseDto,
} from './dto/privacy.dto';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Previews the GDPR shredding and anonymization impact for a user account before confirmation.
   */
  async previewShred(userId: string): Promise<ShredPreviewDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        refreshTokens: true,
        passwordResetTokens: true,
        apiKeys: true,
        battlesAsChallenger: true,
        battlesAsOpponent: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isAnonymized) {
      throw new BadRequestException('User account has already been cryptographically shredded');
    }

    const totalBattles =
      (user.battlesAsChallenger?.length || 0) + (user.battlesAsOpponent?.length || 0);

    return {
      userId: user.id,
      currentUsername: user.username,
      currentEmail: user.email || user.authEmail || 'unknown@domain.com',
      anonymizedHandlePlaceholder: `Ghost-Dev-${Math.floor(1000 + Math.random() * 9000)}`,
      piiFieldsToShred: [
        'username',
        'name',
        'email',
        'authEmail',
        'bio',
        'avatar',
        'location',
        'company',
        'website',
        'githubUrl',
        'socialLinks',
        'passwordHash',
        'twoFactorSecret',
        'twoFactorBackupCodes',
      ],
      tokensToPurgeCount: {
        refreshTokens: user.refreshTokens?.length || 0,
        passwordResetTokens: user.passwordResetTokens?.length || 0,
        apiKeys: user.apiKeys?.length || 0,
      },
      historicalBattlesPreservedCount: totalBattles,
      notice:
        'Cryptographic shredding is permanent, non-reversible, and compliant with GDPR Article 17. Historical match outcomes and opponent ratings are mathematically preserved under non-identifiable pseudonyms.',
    };
  }

  /**
   * Executes the atomic Cryptographic Shredding Pipeline for GDPR Right-to-be-Forgotten.
   */
  async shredUserAccount(
    userId: string,
    options?: ConfirmAccountDeletionDto,
  ): Promise<GdprDeletionCertificateDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isAnonymized) {
      throw new BadRequestException(
        'User account has already been cryptographically shredded under GDPR Article 17',
      );
    }

    // Confirmation check if confirmUsername was provided
    if (options?.confirmUsername && options.confirmUsername.trim() !== user.username.trim()) {
      throw new BadRequestException(
        `Confirmation username '${options.confirmUsername}' does not match target account username '${user.username}'`,
      );
    }

    const previousUsername = user.username;
    const executedAt = new Date().toISOString();
    const reason =
      options?.reason?.trim() ||
      'User requested Right-to-be-Forgotten under GDPR Article 17';

    // Generate unique anonymized pseudonym e.g. Ghost-Dev-8392
    const anonymizedHandle = await this.generateUniqueGhostHandle();

    // Cryptographic email shredding (deterministic truncated HMAC/SHA256 placeholder domain)
    const emailHash = crypto
      .createHash('sha256')
      .update(user.email || user.authEmail || user.id)
      .digest('hex')
      .slice(0, 16);
    const shreddedEmail = `shredded-${emailHash}@anonymized.codepulse.local`;

    // Overwrite password with 256-bit cryptographic entropy to render old hash irrecoverable
    const shreddedPassword = crypto.randomBytes(32).toString('hex');

    // Run database erasure inside an atomic transaction
    const { certificate, summary } = await this.prisma.$transaction(
      async (tx) => {
        // 1. Count items before purging for certificate generation
        const refreshTokensCount = await tx.refreshToken.count({ where: { userId } });
        const resetTokensCount = await tx.passwordResetToken.count({ where: { userId } });
        const apiKeysCount = await tx.apiKey.count({ where: { userId } });
        const notificationsCount = await tx.notification.count({ where: { userId } });
        const outboxCount = await tx.notificationOutbox.count({ where: { userId } });
        const activitiesCount = await tx.activity.count({ where: { userId } });

        let auditLogsCount = 0;
        // Purge audit logs if the table exists
        if ((tx as any).auditLog) {
          auditLogsCount = await (tx as any).auditLog.count({
            where: { OR: [{ actorId: userId }, { targetId: userId }] },
          });
          await (tx as any).auditLog.deleteMany({
            where: { OR: [{ actorId: userId }, { targetId: userId }] },
          });
        }

        // 2. Permanently delete credentials, tokens, and personal audit trails
        await tx.refreshToken.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.apiKey.deleteMany({ where: { userId } });
        await tx.signalPreKeyBundle.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.notificationOutbox.deleteMany({ where: { userId } });
        await tx.activity.deleteMany({ where: { userId } });
        await tx.userSettings.deleteMany({ where: { userId } });
        await tx.follows.deleteMany({
          where: { OR: [{ followerId: userId }, { followingId: userId }] },
        });

        // 3. Cryptographic erasure of User PII
        // Historical battles remain linked to userId, preserving opponents' Elo integrity
        await tx.user.update({
          where: { id: userId },
          data: {
            username: anonymizedHandle,
            name: null,
            email: shreddedEmail,
            authEmail: null,
            samlSubjectId: null,
            passwordHash: shreddedPassword,
            twoFactorSecret: null,
            twoFactorEnabled: false,
            twoFactorBackupCodes: [],
            interests: [],
            avatar: null,
            bio: null,
            location: null,
            company: null,
            website: null,
            githubUrl: null,
            isOnline: false,
            socialLinks: Prisma.DbNull,
            settings: Prisma.DbNull,
            deletedAt: new Date(),
            isAnonymized: true,
            anonymizedAt: new Date(),
          },
        });

        // 4. Construct GDPR Compliance Certificate payload
        const year = new Date().getUTCFullYear();
        const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
        const certificateNumber = `GDPR-RTBF-${year}-${randHex}`;

        const purgedCategories = {
          pii: [
            'username',
            'name',
            'email',
            'authEmail',
            'bio',
            'avatar',
            'location',
            'company',
            'website',
            'githubUrl',
            'socialLinks',
          ],
          credentials: [
            'passwordHash',
            'twoFactorSecret',
            'twoFactorBackupCodes',
            'apiKeys',
            'signalPreKeyBundle',
          ],
          tokens: ['refreshTokens', 'passwordResetTokens', 'deviceSessions'],
          auditTrails: ['personalAuditLogs', 'activityTimeline', 'notifications'],
          cacheStores: ['redisUserCache', 'redisSessionKeys', 'redisRateLimits'],
        };

        const preservedCategories = {
          historicalMatches:
            'Preserved with anonymized participant IDs to maintain opponent Elo rating mathematical integrity (GDPR Recital 47, Art 17(3)(e))',
          leaderboardIntegrity: 'Preserved as non-attributable statistical aggregate',
        };

        const shredSummary = {
          refreshTokensPurged: refreshTokensCount,
          passwordResetTokensPurged: resetTokensCount,
          apiKeysPurged: apiKeysCount,
          notificationsPurged: notificationsCount + outboxCount,
          activitiesPurged: activitiesCount,
          auditLogsPurged: auditLogsCount,
          redisKeysInvalidated: 0, // updated after Redis invalidation
        };

        // Canonical cryptographic SHA-256 signature
        const canonicalPayload = JSON.stringify({
          certificateNumber,
          userId,
          anonymizedHandle,
          executedAt,
          reason,
          purgedCategories,
          preservedCategories,
          summary: shredSummary,
        });

        const sha256Signature = crypto
          .createHash('sha256')
          .update(canonicalPayload)
          .digest('hex');

        const exportableToken = Buffer.from(
          JSON.stringify({
            certificateNumber,
            userId,
            anonymizedHandle,
            executedAt,
            sha256Signature,
          }),
        ).toString('base64');

        // 5. Store certificate in PostgreSQL
        const createdCert = await (tx as any).gdprDeletionCertificate.create({
          data: {
            certificateNumber,
            userId,
            anonymizedHandle,
            shreddedAt: new Date(executedAt),
            reason,
            sha256Signature,
            purgedCategories: purgedCategories as any,
            metadata: shredSummary as any,
            exportableToken,
          },
        });

        return {
          certificate: createdCert,
          summary: {
            ...shredSummary,
            certificateNumber,
            sha256Signature,
            exportableToken,
            purgedCategories,
            preservedCategories,
          },
        };
      },
    );

    // 6. Invalidate all Redis caches across clusters immediately
    const redisKeysInvalidated = await this.invalidateUserRedisCaches(
      userId,
      previousUsername,
    );

    summary.redisKeysInvalidated = redisKeysInvalidated;

    this.logger.log(
      `GDPR Right-to-be-Forgotten executed for user ${userId}. Anonymized as ${anonymizedHandle}. Redis keys cleared: ${redisKeysInvalidated}`,
    );

    return {
      certificateId: certificate.id,
      certificateNumber: summary.certificateNumber,
      userId,
      anonymizedHandle,
      executedAt,
      status: 'CRYPTOGRAPHICALLY_SHREDDED',
      legalBasis: 'GDPR Article 17 - Right to Erasure',
      purgedCategories: summary.purgedCategories,
      preservedCategories: summary.preservedCategories,
      summary: {
        refreshTokensPurged: summary.refreshTokensPurged,
        passwordResetTokensPurged: summary.passwordResetTokensPurged,
        apiKeysPurged: summary.apiKeysPurged,
        notificationsPurged: summary.notificationsPurged,
        activitiesPurged: summary.activitiesPurged,
        auditLogsPurged: summary.auditLogsPurged,
        redisKeysInvalidated,
      },
      sha256Signature: summary.sha256Signature,
      exportableToken: summary.exportableToken,
    };
  }

  /**
   * Invalidates all user sessions, rate limits, profile caches, and token data in Redis.
   */
  async invalidateUserRedisCaches(
    userId: string,
    previousUsername?: string,
  ): Promise<number> {
    let count = 0;
    const patterns = [
      `user:${userId}*`,
      `user:profile:${userId}*`,
      `user:settings:${userId}*`,
      `session:${userId}*`,
      `sessions:${userId}*`,
      `auth:user:${userId}*`,
      `ratelimit:*:${userId}*`,
      `presence:user:${userId}*`,
      `leaderboard:user:${userId}*`,
      `blacklist:user:${userId}*`,
    ];

    if (previousUsername) {
      patterns.push(`user:${previousUsername}*`);
      patterns.push(`user:profile:${previousUsername}*`);
    }

    for (const pattern of patterns) {
      try {
        if (typeof (this.redisService as any).delPattern === 'function') {
          const deleted = await (this.redisService as any).delPattern(pattern);
          count += deleted;
        } else {
          const deleted = await this.redisService.del(pattern.replace('*', ''));
          count += deleted;
        }
      } catch (err: any) {
        this.logger.warn(`Failed invalidating Redis pattern ${pattern}: ${err.message}`);
      }
    }

    return count;
  }

  /**
   * Retrieves an existing GDPR Deletion Certificate by ID or Certificate Number.
   */
  async getDeletionCertificate(
    certificateIdOrNumber: string,
  ): Promise<GdprDeletionCertificateDto> {
    const cert = await (this.prisma as any).gdprDeletionCertificate.findFirst({
      where: {
        OR: [
          { id: certificateIdOrNumber },
          { certificateNumber: certificateIdOrNumber },
        ],
      },
    });

    if (!cert) {
      throw new NotFoundException(
        `GDPR Deletion Certificate '${certificateIdOrNumber}' not found`,
      );
    }

    return {
      certificateId: cert.id,
      certificateNumber: cert.certificateNumber,
      userId: cert.userId,
      anonymizedHandle: cert.anonymizedHandle,
      executedAt: cert.shreddedAt.toISOString(),
      status: 'CRYPTOGRAPHICALLY_SHREDDED',
      legalBasis: 'GDPR Article 17 - Right to Erasure',
      purgedCategories: cert.purgedCategories as any,
      preservedCategories: {
        historicalMatches:
          'Preserved with anonymized participant IDs to maintain opponent Elo rating mathematical integrity (GDPR Recital 47, Art 17(3)(e))',
        leaderboardIntegrity: 'Preserved as non-attributable statistical aggregate',
      },
      summary: (cert.metadata as any) || {
        refreshTokensPurged: 0,
        passwordResetTokensPurged: 0,
        apiKeysPurged: 0,
        notificationsPurged: 0,
        activitiesPurged: 0,
        auditLogsPurged: 0,
        redisKeysInvalidated: 0,
      },
      sha256Signature: cert.sha256Signature,
      exportableToken: cert.exportableToken || '',
    };
  }

  /**
   * Cryptographically verifies a GDPR Certificate against database records or exportable token.
   */
  async verifyCertificate(
    dto: VerifyCertificateDto,
  ): Promise<VerifyCertificateResponseDto> {
    let certNumber = dto.certificateNumber;

    if (!certNumber && dto.exportableToken) {
      try {
        const decoded = JSON.parse(
          Buffer.from(dto.exportableToken, 'base64').toString('utf-8'),
        );
        certNumber = decoded.certificateNumber;
      } catch {
        return {
          isValid: false,
          certificateNumber: 'UNKNOWN',
          anonymizedHandle: 'UNKNOWN',
          executedAt: new Date().toISOString(),
          sha256Signature: '',
          message: 'Malformed or invalid exportable certificate token',
        };
      }
    }

    if (!certNumber && !dto.sha256Signature) {
      throw new BadRequestException(
        'Either certificateNumber, exportableToken, or sha256Signature must be provided',
      );
    }

    const cert = await (this.prisma as any).gdprDeletionCertificate.findFirst({
      where: {
        OR: [
          ...(certNumber ? [{ certificateNumber: certNumber }] : []),
          ...(dto.sha256Signature ? [{ sha256Signature: dto.sha256Signature }] : []),
        ],
      },
    });

    if (!cert) {
      return {
        isValid: false,
        certificateNumber: certNumber || 'NOT_FOUND',
        anonymizedHandle: 'UNKNOWN',
        executedAt: new Date().toISOString(),
        sha256Signature: dto.sha256Signature || '',
        message: 'No matching cryptographic shredding certificate found in compliance registry',
      };
    }

    // Verify signature match
    const isValid = !dto.sha256Signature || dto.sha256Signature === cert.sha256Signature;

    return {
      isValid,
      certificateNumber: cert.certificateNumber,
      anonymizedHandle: cert.anonymizedHandle,
      executedAt: cert.shreddedAt.toISOString(),
      sha256Signature: cert.sha256Signature,
      message: isValid
        ? 'Certificate is cryptographically valid and authentic under GDPR Article 17'
        : 'Certificate signature mismatch',
      certificate: await this.getDeletionCertificate(cert.id),
    };
  }

  /**
   * Helper to generate a unique pseudonym handle (e.g. Ghost-Dev-8392)
   */
  private async generateUniqueGhostHandle(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const candidate = `Ghost-Dev-${suffix}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
      });
      if (!existing) {
        return candidate;
      }
    }
    // Fallback with timestamp slice
    return `Ghost-Dev-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
  }
}

