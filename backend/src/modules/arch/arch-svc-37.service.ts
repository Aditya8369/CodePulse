/**
 * Architecture Service 37: Distributed Task Work-Stealing Scheduler
 * Subsystem: Heterogeneous Worker Nodes
 */

export class WorkStealingSchedulerService {
  private workerQueues = new Map<string, string[]>();

  public registerWorker(workerId: string): void {
    this.workerQueues.set(workerId, []);
  }

  public enqueueTask(workerId: string, taskId: string): void {
    const queue = this.workerQueues.get(workerId);
    if (!queue) throw new Error('Unregistered worker');
    queue.push(taskId);
  }

  public popLocalTask(workerId: string): string | undefined {
    return this.workerQueues.get(workerId)?.shift();
  }

  public stealTask(thiefWorkerId: string): string | undefined {
    // Find victim with greatest queue depth
    let victimId = '';
    let maxDepth = 0;

    for (const [wId, queue] of this.workerQueues.entries()) {
      if (wId !== thiefWorkerId && queue.length > maxDepth) {
        maxDepth = queue.length;
        victimId = wId;
      }
    }

    if (maxDepth > 1) {
      // Steal from tail of victim's queue
      return this.workerQueues.get(victimId)?.pop();
    }
    return undefined;
  }
}
