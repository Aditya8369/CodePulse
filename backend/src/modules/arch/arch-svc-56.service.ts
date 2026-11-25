/**
 * Architecture Service 56: Adaptive Thread Pool Executor
 * Subsystem: CPU Load Telemetry Concurrency Tuning
 */

export class AdaptiveThreadPoolExecutorService {
  private currentWorkers: number;
  private readonly minWorkers: number;
  private readonly maxWorkers: number;

  constructor(minWorkers = 2, maxWorkers = 16, initialWorkers = 4) {
    this.minWorkers = minWorkers;
    this.maxWorkers = maxWorkers;
    this.currentWorkers = initialWorkers;
  }

  public adjustConcurrency(cpuLoadPercentage: number): number {
    if (cpuLoadPercentage > 85) {
      // High CPU pressure: reduce concurrency to avoid thrashing
      this.currentWorkers = Math.max(this.minWorkers, this.currentWorkers - 1);
    } else if (cpuLoadPercentage < 40) {
      // Underutilized CPU: scale up worker capacity
      this.currentWorkers = Math.min(this.maxWorkers, this.currentWorkers + 1);
    }
    return this.currentWorkers;
  }

  public get concurrency(): number {
    return this.currentWorkers;
  }
}
