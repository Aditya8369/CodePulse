/**
 * Architecture Service 64: Event Streaming Partition Rebalancer
 * Subsystem: Minimizing Stop-The-World Rebalances
 */

export class StreamingPartitionRebalancerService {
  public computeStickyAssignment(
    currentAssignments: Map<string, number[]>, // consumerId -> partitionIds
    activeConsumers: string[],
    totalPartitions: number
  ): Map<string, number[]> {
    const newAssignments = new Map<string, number[]>();
    for (const c of activeConsumers) {
      newAssignments.set(c, []);
    }

    const partitionsPerConsumer = Math.floor(totalPartitions / activeConsumers.length);
    const unassigned: number[] = [];

    // Keep existing partition assignments if consumer is still active
    const assignedSet = new Set<number>();
    for (const consumer of activeConsumers) {
      const existing = currentAssignments.get(consumer) || [];
      const retained = existing.slice(0, partitionsPerConsumer);
      newAssignments.set(consumer, retained);
      retained.forEach(p => assignedSet.add(p));
    }

    for (let p = 0; p < totalPartitions; p++) {
      if (!assignedSet.has(p)) {
        unassigned.push(p);
      }
    }

    // Allocate remaining unassigned partitions to consumers with fewest partitions
    while (unassigned.length > 0) {
      const p = unassigned.shift()!;
      let minConsumer = activeConsumers[0];
      let minCount = newAssignments.get(minConsumer)!.length;
      for (const c of activeConsumers) {
        const count = newAssignments.get(c)!.length;
        if (count < minCount) {
          minCount = count;
          minConsumer = c;
        }
      }
      newAssignments.get(minConsumer)!.push(p);
    }

    return newAssignments;
  }
}
