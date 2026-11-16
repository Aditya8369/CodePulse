import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../../prisma/prisma.service';

function fixture(count = 1) {
  const notification = {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count }),
    findUnique: jest.fn().mockResolvedValue({ id: 'notice-1', userId: 'owner', isRead: true }),
  };
  const service = new NotificationsService({ notification } as unknown as PrismaService);
  return { service, notification };
}

describe('NotificationsService ownership', () => {
  it('loads only the signed-in user notifications', async () => {
    const { service, notification } = fixture();
    await service.getUserNotifications('owner');
    expect(notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'owner' }, orderBy: { createdAt: 'desc' },
    });
  });

  it('marks one notification only when it belongs to the signed-in user', async () => {
    const { service, notification } = fixture();
    await service.markAsRead('owner', 'notice-1');
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notice-1', userId: 'owner' }, data: { isRead: true },
    });
  });

  it('does not reveal or update another user notification', async () => {
    const { service, notification } = fixture(0);
    await expect(service.markAsRead('other', 'notice-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(notification.findUnique).not.toHaveBeenCalled();
  });

  it('marks all as read only for the signed-in user', async () => {
    const { service, notification } = fixture();
    await service.markAllAsRead('owner');
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'owner', isRead: false }, data: { isRead: true },
    });
  });
});
