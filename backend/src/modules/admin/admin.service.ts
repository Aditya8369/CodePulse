import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BruteForceService } from '../auth/brute-force.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly bruteForceService?: BruteForceService,
  ) {}

  async deleteUser(userId: string) {
    // In a real scenario, this might be a soft delete or require cascading cleanup
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async setMaintenanceMode(active: boolean) {
    // Usually stored in Redis or a settings table
    return { maintenanceMode: active, updatedAt: new Date() };
  }

  async unlockUser(userIdOrIdentifier: string) {
    let identifier = userIdOrIdentifier;
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdOrIdentifier },
          { username: userIdOrIdentifier },
          { authEmail: userIdOrIdentifier.toLowerCase() },
        ],
      },
    });

    if (user) {
      identifier = user.username || user.authEmail || userIdOrIdentifier;
    }

    if (this.bruteForceService) {
      await this.bruteForceService.unlockUser(identifier);
      if (user?.authEmail && user.authEmail !== identifier) {
        await this.bruteForceService.unlockUser(user.authEmail);
      }
    }

    return {
      success: true,
      id: user?.id || userIdOrIdentifier,
      username: identifier,
      message: `Account for ${identifier} successfully unlocked and failed attempt counters have been reset.`,
    };
  }
}
