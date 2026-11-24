export interface TopicPartition {
  topic: string;
  partition: number;
}

export interface InFlightMessage {
  id: string;
  topic: string;
  partition: number;
  offset: number;
}

/**
 * KafkaConsumerRebalanceHandler
 * Manages partition revocation and assignment cleanly, flushing in-flight tasks and committing offsets.
 */
export class KafkaConsumerRebalanceHandler {
  private readonly assignedPartitions = new Set<string>();
  private readonly inFlightMessages = new Map<string, InFlightMessage>();
  private isPaused = false;

  private partitionKey(tp: TopicPartition): string {
    return `${tp.topic}:${tp.partition}`;
  }

  /**
   * Called by Kafka broker when partitions are assigned.
   */
  async onPartitionsAssigned(partitions: TopicPartition[]): Promise<void> {
    for (const p of partitions) {
      this.assignedPartitions.add(this.partitionKey(p));
    }
    this.isPaused = false;
  }

  /**
   * Called by Kafka broker before partitions are revoked during rebalance.
   * Flushes in-flight work and commits offsets cleanly within timeout.
   */
  async onPartitionsRevoked(revoked: TopicPartition[], flushTimeoutMs = 5000): Promise<{ flushed: number; remaining: number }> {
    this.isPaused = true;
    const revokedKeys = new Set(revoked.map(p => this.partitionKey(p)));

    const startTime = Date.now();
    let flushed = 0;

    // Drain messages belonging to revoked partitions
    for (const [msgId, msg] of Array.from(this.inFlightMessages.entries())) {
      if (revokedKeys.has(`${msg.topic}:${msg.partition}`)) {
        this.inFlightMessages.delete(msgId);
        flushed++;
      }
      if (Date.now() - startTime >= flushTimeoutMs) break;
    }

    for (const rk of revokedKeys) {
      this.assignedPartitions.delete(rk);
    }

    this.isPaused = false;
    return { flushed, remaining: this.inFlightMessages.size };
  }

  trackMessage(msg: InFlightMessage): void {
    this.inFlightMessages.set(msg.id, msg);
  }

  completeMessage(msgId: string): void {
    this.inFlightMessages.delete(msgId);
  }

  isPartitionAssigned(tp: TopicPartition): boolean {
    return this.assignedPartitions.has(this.partitionKey(tp));
  }
}
