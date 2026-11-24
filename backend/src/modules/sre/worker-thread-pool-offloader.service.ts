export class WorkerThreadPoolOffloaderService {
  private activeJobs = 0;
  private maxConcurrency = 4;

  public async offload<T>(task: () => Promise<T> | T): Promise<T> {
    while (this.activeJobs >= this.maxConcurrency) {
      await new Promise(r => setTimeout(r, 10));
    }

    this.activeJobs++;
    try {
      return await task();
    } finally {
      this.activeJobs--;
    }
  }

  public getActiveJobs(): number {
    return this.activeJobs;
  }
}
