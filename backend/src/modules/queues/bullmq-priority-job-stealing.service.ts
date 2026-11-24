export interface QueuedJob {
  id: string;
  priority: number; // lower number = higher priority
  payload: any;
}

export interface WorkerPod {
  podId: string;
  queue: QueuedJob[];
}

export class BullMQPriorityJobStealingService {
  private workers = new Map<string, WorkerPod>();
  private stealThreshold: number;

  constructor(stealThreshold: number = 2) {
    this.stealThreshold = stealThreshold;
  }

  public registerWorker(podId: string): void {
    if (!this.workers.has(podId)) {
      this.workers.set(podId, { podId, queue: [] });
    }
  }

  public addJob(podId: string, job: QueuedJob): void {
    this.registerWorker(podId);
    const worker = this.workers.get(podId)!;
    worker.queue.push(job);
    // Sort so highest priority (lowest priority value) is at front
    worker.queue.sort((a, b) => a.priority - b.priority);
  }

  public attemptSteal(idlePodId: string, maxSteal: number = 2): QueuedJob[] {
    this.registerWorker(idlePodId);
    const idleWorker = this.workers.get(idlePodId)!;

    if (idleWorker.queue.length > 0) {
      return []; // Not idle
    }

    // Find the victim worker with highest queue length exceeding threshold
    let victim: WorkerPod | null = null;
    let maxDepth = this.stealThreshold;

    for (const [id, worker] of this.workers.entries()) {
      if (id !== idlePodId && worker.queue.length > maxDepth) {
        maxDepth = worker.queue.length;
        victim = worker;
      }
    }

    if (!victim) return [];

    // Steal from victim's tail (lower priority tasks) to preserve locality for top priority
    const countToSteal = Math.min(maxSteal, Math.floor(victim.queue.length / 2));
    const stolen = victim.queue.splice(victim.queue.length - countToSteal, countToSteal);

    idleWorker.queue.push(...stolen);
    return stolen;
  }

  public getQueueDepth(podId: string): number {
    return this.workers.get(podId)?.queue.length || 0;
  }
}
