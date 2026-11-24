import { OptimisticLockCoordinatorService, VersionedEntity } from './optimistic-lock-coordinator.service';
import { ConflictException } from '@nestjs/common';

interface MockUserWallet extends VersionedEntity {
  id: string;
  userId: string;
  xp: number;
  tokens: number;
  version: number;
}

describe('OptimisticLockCoordinatorService', () => {
  let coordinator: OptimisticLockCoordinatorService;

  beforeEach(() => {
    coordinator = new OptimisticLockCoordinatorService();
  });

  it('should successfully update entity on first attempt when no contention exists', async () => {
    let storedWallet: MockUserWallet = { id: 'w-1', userId: 'u-1', xp: 100, tokens: 50, version: 1 };

    const result = await coordinator.executeWithRetry<MockUserWallet>(
      'w-1',
      async () => ({ ...storedWallet }),
      async (w) => {
        w.xp += 25;
        w.tokens += 10;
        return w;
      },
      async (updated, expectedVersion) => {
        if (storedWallet.version === expectedVersion) {
          storedWallet = { ...updated };
          return true;
        }
        return false;
      },
    );

    expect(result.entity.xp).toBe(125);
    expect(result.entity.tokens).toBe(60);
    expect(result.entity.version).toBe(2);
    expect(result.retriesAttempted).toBe(0);
    expect(storedWallet.version).toBe(2);
  });

  it('should handle version collision, retry, and successfully apply mutation', async () => {
    let storedWallet: MockUserWallet = { id: 'w-2', userId: 'u-2', xp: 500, tokens: 100, version: 1 };
    let simulatedConflictTriggered = false;

    const result = await coordinator.executeWithRetry<MockUserWallet>(
      'w-2',
      async () => ({ ...storedWallet }),
      async (w) => {
        w.xp += 50;
        return w;
      },
      async (updated, expectedVersion) => {
        // Force conflict on first attempt
        if (!simulatedConflictTriggered) {
          simulatedConflictTriggered = true;
          storedWallet.version = 2; // another concurrent worker bumped version!
          return false;
        }

        if (storedWallet.version === expectedVersion) {
          storedWallet = { ...updated };
          return true;
        }
        return false;
      },
    );

    expect(result.retriesAttempted).toBe(1);
    expect(result.entity.xp).toBe(550);
    expect(result.entity.version).toBe(3);
  });

  it('should throw ConflictException if all retry attempts are exhausted', async () => {
    const storedWallet: MockUserWallet = { id: 'w-fail', userId: 'u-fail', xp: 0, tokens: 0, version: 1 };

    await expect(
      coordinator.executeWithRetry<MockUserWallet>(
        'w-fail',
        async () => ({ ...storedWallet }),
        async (w) => w,
        async () => false, // Always fail CAS check
        2, // 2 retries
      ),
    ).rejects.toThrow(ConflictException);
  });
});
