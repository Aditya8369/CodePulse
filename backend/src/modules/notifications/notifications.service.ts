import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    if (result.count === 0) throw new NotFoundException('Notification not found');
    return this.prisma.notification.findUnique({ where: { id: notificationId } });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markCategoryAsRead(userId: string, category: string) {
    const types: Record<string, NotificationType[]> = {
      battles: [NotificationType.BATTLE],
      achievements: [NotificationType.ACHIEVEMENT, NotificationType.CHALLENGE, NotificationType.LEVEL_UP],
      social: [NotificationType.FRIEND],
      system: [NotificationType.SYSTEM],
    };
    if (!Object.hasOwn(types, category)) return null;
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false, type: { in: types[category] } },
      data: { isRead: true },
    });
  }

  async createNotification(data: { userId: string, type: NotificationType, title: string, message: string }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }
}
