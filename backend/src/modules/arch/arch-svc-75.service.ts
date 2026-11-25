/**
 * Architecture Service 75: Event-Sourced Aggregate Branch Merger
 * Subsystem: Speculative Code Evaluation Branches
 */

export interface AggregateEvent {
  id: string;
  type: string;
  version: number;
}

export class AggregateBranchMergerService {
  public mergeBranches(mainEvents: AggregateEvent[], branchEvents: AggregateEvent[]): { merged: AggregateEvent[]; conflicts: string[] } {
    const mainIds = new Set(mainEvents.map(e => e.id));
    const merged: AggregateEvent[] = [...mainEvents];
    const conflicts: string[] = [];

    let currentVersion = mainEvents.length > 0 ? mainEvents[mainEvents.length - 1].version : 0;

    for (const bEvent of branchEvents) {
      if (mainIds.has(bEvent.id)) {
        conflicts.push(bEvent.id);
        continue;
      }
      currentVersion++;
      merged.push({ ...bEvent, version: currentVersion });
    }

    return { merged, conflicts };
  }
}
