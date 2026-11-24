import { Injectable } from '@nestjs/common';

@Injectable()
export class WriteBehindCacheBreakerService {
  private readonly invalidatedKeys = new Set<string>();
  private readonly debounceWindowMs = 200;
  private lastFlush = Date.now();

  public scheduleInvalidation(key: string): boolean {
    this.invalidatedKeys.add(key);
    return true;
  }

  public flushInvalidations(): { batchCount: number; keys: string[] } {
    const keys = Array.from(this.invalidatedKeys);
    this.invalidatedKeys.clear();
    this.lastFlush = Date.now();
    return { batchCount: keys.length, keys };
  }

  public getPendingCount(): number {
    return this.invalidatedKeys.size;
  }
}
