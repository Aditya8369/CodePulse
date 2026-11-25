/**
 * Architecture Service 17: Priority Inversion Prevention Queue Scheduler
 * Subsystem: Asynchronous Task Priority Inversion Prevention
 */

export interface ScheduledTask {
  id: string;
  basePriority: number; // Higher number = higher priority
  effectivePriority: number;
  holdingLock?: string;
  enqueuedAt: number;
}

export class PriorityInversionSchedulerService {
  private queue: ScheduledTask[] = [];
  private lockHolders = new Map<string, string>(); // lockName -> taskId

  public enqueue(id: string, basePriority: number, holdingLock?: string): ScheduledTask {
    const task: ScheduledTask = {
      id,
      basePriority,
      effectivePriority: basePriority,
      holdingLock,
      enqueuedAt: Date.now(),
    };
    if (holdingLock) {
      this.lockHolders.set(holdingLock, id);
    }
    this.queue.push(task);
    this.rebalancePriorities();
    return task;
  }

  public requestLock(taskId: string, lockName: string): void {
    const holderTaskId = this.lockHolders.get(lockName);
    if (!holderTaskId || holderTaskId === taskId) return;

    const waitingTask = this.queue.find(t => t.id === taskId);
    const holderTask = this.queue.find(t => t.id === holderTaskId);

    if (waitingTask && holderTask && waitingTask.effectivePriority > holderTask.effectivePriority) {
      // Priority Inheritance Protocol: elevate holder task priority
      holderTask.effectivePriority = waitingTask.effectivePriority;
      this.rebalancePriorities();
    }
  }

  public releaseLock(lockName: string): void {
    const holderTaskId = this.lockHolders.get(lockName);
    if (!holderTaskId) return;

    this.lockHolders.delete(lockName);
    const task = this.queue.find(t => t.id === holderTaskId);
    if (task) {
      task.effectivePriority = task.basePriority;
      task.holdingLock = undefined;
      this.rebalancePriorities();
    }
  }

  private rebalancePriorities(): void {
    this.queue.sort((a, b) => {
      if (b.effectivePriority !== a.effectivePriority) {
        return b.effectivePriority - a.effectivePriority;
      }
      if (a.holdingLock && !b.holdingLock) return -1;
      if (!a.holdingLock && b.holdingLock) return 1;
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  public dequeueNext(): ScheduledTask | undefined {
    return this.queue.shift();
  }

  public getTask(id: string): ScheduledTask | undefined {
    return this.queue.find(t => t.id === id);
  }
}
