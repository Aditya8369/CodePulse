import { Injectable } from '@nestjs/common';

@Injectable()
export class BcryptStarvationGuardService {
  private activeHashJobs = 0;
  private readonly maxConcurrentHashes = 4; // Bound CPU-heavy hashes to 4 concurrent

  public tryAcquireHashSlot(): boolean {
    if (this.activeHashJobs >= this.maxConcurrentHashes) {
      return false;
    }
    this.activeHashJobs++;
    return true;
  }

  public releaseHashSlot(): void {
    this.activeHashJobs = Math.max(0, this.activeHashJobs - 1);
  }

  public getActiveJobs(): number {
    return this.activeHashJobs;
  }
}
