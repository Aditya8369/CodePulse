export interface ConsumerNode {
  consumerId: string;
  rackId: string;
}

export interface PartitionMetadata {
  topic: string;
  partition: number;
  leaderRackId: string;
}

export class KafkaRackAwareAssignorService {
  public assign(
    consumers: ConsumerNode[],
    partitions: PartitionMetadata[],
    previousAssignments?: Map<string, string[]> // consumerId -> partitionKeys
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const c of consumers) {
      result.set(c.consumerId, []);
    }

    if (consumers.length === 0) return result;

    const unassigned: PartitionMetadata[] = [];
    const partitionKey = (p: PartitionMetadata) => `${p.topic}-${p.partition}`;

    // 1. Maintain stickiness if valid
    const claimedKeys = new Set<string>();
    if (previousAssignments) {
      for (const [consumerId, keys] of previousAssignments.entries()) {
        const consumer = consumers.find(c => c.consumerId === consumerId);
        if (!consumer) continue;

        for (const k of keys) {
          const match = partitions.find(p => partitionKey(p) === k);
          if (match && !claimedKeys.has(k) && match.leaderRackId === consumer.rackId) {
            result.get(consumerId)!.push(k);
            claimedKeys.add(k);
          }
        }
      }
    }

    for (const p of partitions) {
      const k = partitionKey(p);
      if (!claimedKeys.has(k)) {
        unassigned.push(p);
      }
    }

    // 2. Assign remaining prioritizing rack locality
    for (const p of unassigned) {
      const k = partitionKey(p);
      // Prefer consumer in same rack with fewest partitions
      const sameRackConsumers = consumers
        .filter(c => c.rackId === p.leaderRackId)
        .sort((a, b) => result.get(a.consumerId)!.length - result.get(b.consumerId)!.length);

      if (sameRackConsumers.length > 0) {
        result.get(sameRackConsumers[0].consumerId)!.push(k);
      } else {
        // Fallback to least loaded consumer across any rack
        const leastLoaded = [...consumers].sort(
          (a, b) => result.get(a.consumerId)!.length - result.get(b.consumerId)!.length
        )[0];
        result.get(leastLoaded.consumerId)!.push(k);
      }
    }

    return result;
  }
}
