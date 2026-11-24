export type VectorClock = Record<string, number>; // clusterId -> counter

export interface ReplicatedEntity {
  entityId: string;
  vectorClock: VectorClock;
  timestampMs: number;
  data: any;
}

export type ClockComparison = 'DOMINATES' | 'DOMINATED' | 'EQUAL' | 'CONCURRENT';

export class MirrorMakerConflictResolverService {
  public compareClocks(a: VectorClock, b: VectorClock): ClockComparison {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aGreater = false;
    let bGreater = false;

    for (const key of keys) {
      const valA = a[key] || 0;
      const valB = b[key] || 0;
      if (valA > valB) aGreater = true;
      if (valB > valA) bGreater = true;
    }

    if (aGreater && !bGreater) return 'DOMINATES';
    if (bGreater && !aGreater) return 'DOMINATED';
    if (!aGreater && !bGreater) return 'EQUAL';
    return 'CONCURRENT';
  }

  public resolveConflict(local: ReplicatedEntity, incoming: ReplicatedEntity): {
    winner: ReplicatedEntity;
    mergedClock: VectorClock;
    resolution: 'LOCAL_ACCEPTED' | 'INCOMING_ACCEPTED' | 'CONCURRENT_LWW';
  } {
    const comparison = this.compareClocks(local.vectorClock, incoming.vectorClock);

    // Compute merged vector clock taking max of each node
    const mergedClock: VectorClock = {};
    const keys = new Set([...Object.keys(local.vectorClock), ...Object.keys(incoming.vectorClock)]);
    for (const k of keys) {
      mergedClock[k] = Math.max(local.vectorClock[k] || 0, incoming.vectorClock[k] || 0);
    }

    if (comparison === 'DOMINATES' || comparison === 'EQUAL') {
      return { winner: local, mergedClock, resolution: 'LOCAL_ACCEPTED' };
    }
    if (comparison === 'DOMINATED') {
      return { winner: incoming, mergedClock, resolution: 'INCOMING_ACCEPTED' };
    }

    // Concurrent conflict: apply Last-Write-Wins (LWW) on physical wall-clock timestamp
    const winner = incoming.timestampMs >= local.timestampMs ? incoming : local;
    return {
      winner,
      mergedClock,
      resolution: 'CONCURRENT_LWW'
    };
  }
}
