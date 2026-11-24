import { Injectable, Logger, ConflictException } from '@nestjs/common';

export interface VersionedEntity {
  id: string;
  version: number;
  [key: string]: any;
}

export interface OptimisticMutationResult<T extends VersionedEntity> {
  entity: T;
  retriesAttempted: number;
  durationMs: number;
}

@Injectable()
export class OptimisticLockCoordinatorService {
  private readonly logger = new Logger(OptimisticLockCoordinatorService.name);

  // Default retry limit
  public static readonly DEFAULT_MAX_RETRIES = 3;

  /**
   * Executes a mutation with optimistic version verification and automated exponential backoff retries.
   * Ensures 0% lost updates under concurrent updates.
   */
  public async executeWithRetry<T extends VersionedEntity>(
    entityId: string,
    fetcher: () => Promise<T | null>,
    mutator: (current: T) => Promise<T>,
    persister: (updated: T, expectedVersion: number) => Promise<boolean>,
    maxRetries = OptimisticLockCoordinatorService.DEFAULT_MAX_RETRIES,
  ): Promise<OptimisticMutationResult<T>> {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= maxRetries) {
      const current = await fetcher();
      if (!current) {
        throw new Error(`Entity ${entityId} not found`);
      }

      const expectedVersion = current.version;
      const mutated = await mutator({ ...current });
      // Bump version atomically
      mutated.version = expectedVersion + 1;

      const success = await persister(mutated, expectedVersion);
      if (success) {
        const durationMs = Date.now() - startTime;
        return {
          entity: mutated,
          retriesAttempted: attempt,
          durationMs,
        };
      }

      attempt++;
      if (attempt <= maxRetries) {
        // Exponential backoff with full jitter: 10ms * (2^attempt) + jitter
        const baseDelay = 10 * Math.pow(2, attempt);
        const jitter = Math.random() * baseDelay;
        const delay = Math.round(baseDelay + jitter);
        this.logger.warn(`Version conflict on entity ${entityId} (expected v${expectedVersion}). Retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new ConflictException(
      `Optimistic lock contention failed for entity '${entityId}' after ${maxRetries} retries. Concurrent mutation detected.`,
    );
  }
}
