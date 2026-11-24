import { Injectable } from '@nestjs/common';

export type TargetDatabase = 'PRIMARY' | 'REPLICA';

@Injectable()
export class ReplicaLagPredictiveRouterService {
  private readonly maxAllowedLagMs = 250;

  public routeQuery(isWrite: boolean, replicaLagMs: number, requiresReadYourWrites: boolean): TargetDatabase {
    if (isWrite || requiresReadYourWrites) {
      return 'PRIMARY';
    }

    if (replicaLagMs > this.maxAllowedLagMs) {
      return 'PRIMARY'; // Fallback to primary to avoid stale reads
    }

    return 'REPLICA';
  }
}
