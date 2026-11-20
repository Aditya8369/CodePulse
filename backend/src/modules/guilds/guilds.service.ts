import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGuildDto, UpdateMemberRoleDto } from './dto/guilds.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class GuildsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGuild(userId: string, dto: CreateGuildDto) {
    // Verify user level >= 5 and rating exists
    const rating = await this.prisma.developerRating.findUnique({
      where: { userId },
    });

    if (!rating || rating.level < 5) {
      throw new BadRequestException('Creating a guild requires reaching Developer Level 5 or higher');
    }

    if (rating.xp < 250) {
      throw new BadRequestException('Creating a guild requires at least 250 XP fee');
    }

    // Check slug uniqueness
    const existing = await this.prisma.guild.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('A guild with this slug already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      // Deduct 250 XP fee
      await tx.developerRating.update({
        where: { userId },
        data: { xp: { decrement: 250 } },
      });

      // Record transaction
      await tx.xpTransaction.create({
        data: {
          userId,
          amount: -250,
          source: 'GUILD_CREATION',
          description: `Created guild [${dto.tag.toUpperCase()}] ${dto.name}`,
        },
      });

      // Create Guild
      const guild = await tx.guild.create({
        data: {
          name: dto.name,
          slug: dto.slug.toLowerCase(),
          tag: dto.tag.toUpperCase(),
          description: dto.description,
          avatarUrl: dto.avatarUrl,
          bannerUrl: dto.bannerUrl,
          isPrivate: dto.isPrivate || false,
          ownerId: userId,
          totalXp: 250,
          level: 1,
        },
      });

      // Add Creator as OWNER
      await tx.guildMember.create({
        data: {
          guildId: guild.id,
          userId,
          role: 'OWNER',
          xpContributed: 250,
        },
      });

      return guild;
    });
  }

  async getGuildBySlug(slug: string) {
    const guild = await this.prisma.guild.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                rating: true,
              },
            },
          },
          orderBy: { xpContributed: 'desc' },
        },
      },
    });

    if (!guild) {
      throw new NotFoundException(`Guild '${slug}' not found`);
    }

    return guild;
  }

  async joinGuild(guildId: string, userId: string, inviteCode?: string) {
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      include: { members: true },
    });

    if (!guild) {
      throw new NotFoundException('Guild not found');
    }

    if (guild.members.length >= guild.maxMembers) {
      throw new BadRequestException('Guild has reached maximum member capacity');
    }

    const alreadyMember = guild.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      throw new BadRequestException('You are already a member of this guild');
    }

    if (guild.isPrivate) {
      if (!inviteCode) {
        throw new ForbiddenException('This guild is private. Valid invite code required.');
      }
      const invite = await this.prisma.guildInvite.findUnique({
        where: { inviteCode },
      });
      if (!invite || invite.guildId !== guildId || invite.expiresAt < new Date() || invite.usesCount >= invite.maxUses) {
        throw new BadRequestException('Invalid or expired invite code');
      }

      await this.prisma.guildInvite.update({
        where: { id: invite.id },
        data: { usesCount: { increment: 1 } },
      });
    }

    return this.prisma.guildMember.create({
      data: {
        guildId,
        userId,
        role: 'MEMBER',
      },
    });
  }

  async updateMemberRole(guildId: string, actorId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const actorMembership = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: actorId } },
    });

    if (!actorMembership || actorMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only guild owners can modify member roles');
    }

    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot modify your own owner role');
    }

    return this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  async kickMember(guildId: string, actorId: string, targetUserId: string) {
    const actorMembership = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: actorId } },
    });

    if (!actorMembership || (actorMembership.role !== 'OWNER' && actorMembership.role !== 'ADMIN')) {
      throw new ForbiddenException('Insufficient permissions to remove members');
    }

    if (actorId === targetUserId) {
      throw new BadRequestException('Guild owners cannot kick themselves');
    }

    return this.prisma.guildMember.delete({
      where: { guildId_userId: { guildId, userId: targetUserId } },
    });
  }
}
