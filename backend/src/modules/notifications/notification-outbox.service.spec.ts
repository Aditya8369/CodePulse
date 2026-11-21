import { NotificationType, type Prisma } from '@prisma/client';
import { NotificationOutboxService } from './notification-outbox.service';
import { enqueueNotification } from './notification-outbox';
import type { PrismaService } from '../../prisma/prisma.service';

function fixture(attempts = 1) {
  const row = {
    id: 'event-id',
    userId: 'u',
    type: NotificationType.SYSTEM,
    title: 'Title',
    message: 'Message',
    attempts,
  };
  const tx = {
    notificationOutbox: {
      updateMany: jest
        .fn<
          Promise<{ count: number }>,
          [Prisma.NotificationOutboxUpdateManyArgs]
        >()
        .mockResolvedValue({ count: 1 }),
    },
    notification: {
      upsert: jest
        .fn<Promise<unknown>, [Prisma.NotificationUpsertArgs]>()
        .mockResolvedValue({ id: row.id, isRead: true }),
    },
  };
  const prisma = {
    notificationOutbox: {
      updateMany: jest
        .fn<
          Promise<{ count: number }>,
          [Prisma.NotificationOutboxUpdateManyArgs]
        >()
        .mockResolvedValue({ count: 1 }),
    },
    $queryRawUnsafe: jest
      .fn<
        Promise<(typeof row)[]>,
        [string, Date, Date, string, number, number]
      >()
      .mockResolvedValue([row]),
    $transaction: jest.fn((work: (value: typeof tx) => Promise<number>) =>
      work(tx),
    ),
  };
  return {
    row,
    tx,
    prisma,
    worker: new NotificationOutboxService(prisma as unknown as PrismaService),
  };
}

describe('notification outbox', () => {
  it('uses a caller transaction and stable recipient/event key without overwriting replay payload', async () => {
    const tx = { notificationOutbox: { upsert: jest.fn() } };
    const event = {
      eventKey: 'level:u:2',
      userId: 'u',
      type: NotificationType.LEVEL_UP,
      title: 'Level 2',
      message: 'Earned',
    };
    await enqueueNotification(tx as unknown as Prisma.TransactionClient, event);
    expect(tx.notificationOutbox.upsert).toHaveBeenCalledWith({
      where: { eventKey_userId: { eventKey: event.eventKey, userId: 'u' } },
      create: event,
      update: {},
    });
    expect(() =>
      enqueueNotification(tx as unknown as Prisma.TransactionClient, {
        ...event,
        title: '',
      }),
    ).toThrow('Invalid');
  });

  it('projects the same inbox ID and never resets read state during replay', async () => {
    const f = fixture();
    expect(await f.worker.drain()).toEqual({ claimed: 1, delivered: 1 });
    const input = f.tx.notification.upsert.mock.calls[0][0];
    expect(input).toEqual({
      where: { id: f.row.id },
      create: {
        id: f.row.id,
        userId: 'u',
        type: 'SYSTEM',
        title: 'Title',
        message: 'Message',
      },
      update: {},
    });
    expect(
      f.tx.notificationOutbox.updateMany.mock.calls[0][0].where?.leaseToken,
    ).toEqual(expect.any(String));
    expect(
      f.tx.notificationOutbox.updateMany.mock.calls[0][0].data.status,
    ).toBe('DELIVERED');
  });

  it('does not deliver after another worker has reclaimed its lease', async () => {
    const f = fixture();
    f.tx.notificationOutbox.updateMany.mockResolvedValue({ count: 0 });
    expect(await f.worker.drain()).toEqual({ claimed: 1, delivered: 0 });
    expect(f.tx.notification.upsert).not.toHaveBeenCalled();
  });

  it.each([1, 5])(
    'bounds retries after a delivery failure on attempt %i',
    async (attempts) => {
      const f = fixture(attempts);
      f.prisma.$transaction.mockRejectedValueOnce(
        new Error('private database payload must not be stored'),
      );
      await f.worker.drain();
      const call = f.prisma.notificationOutbox.updateMany.mock.calls.at(-1)![0];
      expect(call.where?.id).toBe(f.row.id);
      expect(call.where?.status).toBe('PROCESSING');
      expect(call.where?.leaseToken).toEqual(expect.any(String));
      expect(call.data.status).toBe(attempts === 5 ? 'FAILED' : 'PENDING');
      expect(call.data.lastError).toBe('Inbox projection failed');
      expect(call.data.leaseToken).toBeNull();
      expect(call.data.leaseExpiresAt).toBeNull();
    },
  );

  it('recovers final expired leases and limits the selected batch', async () => {
    const f = fixture();
    await f.worker.drain(10);
    const recovery = f.prisma.notificationOutbox.updateMany.mock.calls[0][0];
    expect(recovery.where?.status).toBe('PROCESSING');
    expect(recovery.where?.attempts).toEqual({ gte: 5 });
    expect(JSON.stringify(recovery.where?.leaseExpiresAt)).toContain('lte');
    expect(recovery.data).toEqual({
      status: 'FAILED',
      lastError: 'Final delivery lease expired',
      leaseToken: null,
      leaseExpiresAt: null,
    });
    expect(f.prisma.$queryRawUnsafe.mock.calls[0][4]).toBe(10);
    await expect(f.worker.drain(101)).rejects.toThrow('limit');
  });

  it('operator retry only resets failed events', async () => {
    const f = fixture();
    await f.worker.retryFailed('event-id');
    expect(
      f.prisma.notificationOutbox.updateMany.mock.calls.at(-1)![0],
    ).toMatchObject({
      where: { id: 'event-id', status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
      },
    });
  });
});
