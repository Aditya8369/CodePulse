import { Injectable, Logger } from '@nestjs/common';

export interface EntitySnapshot<T = unknown> {
  version: number;
  state: T;
  timestamp: number;
}

@Injectable()
export class EntitySnapshottingOffloaderService<T = unknown> {
  private readonly logger = new Logger(EntitySnapshottingOffloaderService.name);
  private snapshots = new Map<string, EntitySnapshot<T>>();
  private readonly snapshotInterval = 100;

  public recordEvent(entityId: string, version: number, state: T): boolean {
    if (version % this.snapshotInterval === 0) {
      this.snapshots.set(entityId, {
        version,
        state,
        timestamp: Date.now(),
      });
      this.logger.log(`Captured state snapshot for entity ${entityId} at version ${version}`);
      return true;
    }
    return false;
  }

  public getSnapshot(entityId: string): EntitySnapshot<T> | null {
    return this.snapshots.get(entityId) || null;
  }
}
