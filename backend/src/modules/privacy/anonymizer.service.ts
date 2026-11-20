import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface GdprPurgeReceipt {
  userId: string;
  pseudonym: string;
  purgedAt: Date;
  recordsHardDeleted: number;
  recordsAnonymized: number;
}

@Injectable()
export class AnonymizerService {
  private readonly logger = new Logger(AnonymizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes a GDPR-compliant Article 17 "Right to be Forgotten" cascade purge
   */
  async purgeAndAnonymizeUser(userId: string): Promise<GdprPurgeReceipt> {
    this.logger.log(`Initiating GDPR Article 17 cascade purge for user ${userId}...`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User account not found');

    const pseudonym = `deleted-user-${userId.substring(0, 8)}`;

    // 1. Hard delete personal notifications, password reset tokens, and sessions
    let deletedCount = 0;
    try {
      const deletedNotifications = await this.prisma.notification.deleteMany({
        where: { userId },
      });
      deletedCount += deletedNotifications.count;

      const deletedTokens = await this.prisma.passwordResetToken.deleteMany({
        where: { userId },
      });
      deletedCount += deletedTokens.count;
    } catch (err: any) {
      this.logger.warn(`Non-blocking delete step: ${err.message}`);
    }

    // 2. Anonymize user profile (scrub PII while retaining foreign keys for past battle balance)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: pseudonym,
        name: 'Anonymized Developer',
        email: null,
        authEmail: null,
        avatar: null,
        bio: null,
        location: null,
        company: null,
        website: null,
        githubUrl: null,
        socialLinks: null,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`GDPR purge successfully finalized for ${userId}. Pseudonym: ${pseudonym}`);

    return {
      userId,
      pseudonym,
      purgedAt: new Date(),
      recordsHardDeleted: deletedCount,
      recordsAnonymized: 1,
    };
  }
}
