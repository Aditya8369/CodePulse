import { PrismaClient } from '@prisma/client';
import { NotificationOutboxService } from '../src/modules/notifications/notification-outbox.service';
import type { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaClient();
  try {
    const worker = new NotificationOutboxService(
      prisma as unknown as PrismaService,
    );
    const retry = process.argv.indexOf('--retry');
    if (retry !== -1) {
      if (!process.argv[retry + 1])
        throw new Error('--retry requires an event ID');
      console.log(await worker.retryFailed(process.argv[retry + 1]));
    } else if (process.argv.includes('--drain')) {
      console.log(await worker.drain());
    } else {
      console.log(
        await prisma.notificationOutbox.findMany({
          where: { status: 'FAILED' },
          orderBy: { createdAt: 'asc' },
          take: 25,
          select: {
            id: true,
            eventKey: true,
            userId: true,
            attempts: true,
            lastError: true,
            createdAt: true,
          },
        }),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Outbox command failed; check database configuration and migrations.',
  );
  process.exitCode = 1;
});
