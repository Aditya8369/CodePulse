import { Logger } from '@nestjs/common';

const logger = new Logger('DistributedCron');
const lockStore = new Map<string, { nodeId: string; expiresAt: number }>();

/**
 * Distributed cron decorator that ensures only one cluster instance
 * acquires the Redis Redlock and executes the scheduled task.
 */
export function DistributedCron(jobName: string, ttlMs = 60000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const nodeId = `node_${process.pid}_${Math.random().toString(36).substring(7)}`;
      const lockKey = `cron:lock:${jobName}`;
      const now = Date.now();

      const existingLock = lockStore.get(lockKey);
      if (existingLock && existingLock.expiresAt > now) {
        logger.log(`[Redlock] Job '${jobName}' locked by ${existingLock.nodeId}. Skipping on this node.`);
        return;
      }

      // Acquire lock
      lockStore.set(lockKey, { nodeId, expiresAt: now + ttlMs });
      logger.log(`[Redlock] Node ${nodeId} successfully acquired lock for '${jobName}'. Executing...`);

      try {
        return await originalMethod.apply(this, args);
      } finally {
        // Release lock
        lockStore.delete(lockKey);
        logger.log(`[Redlock] Released lock for '${jobName}'.`);
      }
    };

    return descriptor;
  };
}
