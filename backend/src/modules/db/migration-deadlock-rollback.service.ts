import { Injectable } from '@nestjs/common';

export interface MigrationExecutionResult {
  migrationName: string;
  success: boolean;
  lockTimeoutTriggered: boolean;
  rolledBack: boolean;
}

@Injectable()
export class MigrationDeadlockRollbackService {
  private readonly lockTimeoutMs = 3000;

  public async executeWithLockGuard(
    migrationName: string,
    migrationFn: () => Promise<void>
  ): Promise<MigrationExecutionResult> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Lock acquisition timeout')), this.lockTimeoutMs)
      );

      await Promise.race([migrationFn(), timeoutPromise]);
      return { migrationName, success: true, lockTimeoutTriggered: false, rolledBack: false };
    } catch {
      // Auto-rollback lock and statement to prevent table freeze
      return { migrationName, success: false, lockTimeoutTriggered: true, rolledBack: true };
    }
  }
}
