export interface BrokerHealth {
  brokerId: string;
  isAlive: boolean;
  lastHeartbeatMs: number;
  inSyncReplicasCount: number;
}

export class KafkaPartitionDetectorService {
  private brokers = new Map<string, BrokerHealth>();
  private heartbeatTimeoutMs: number;
  private minISR: number;

  constructor(heartbeatTimeoutMs: number = 3000, minISR: number = 2) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.minISR = minISR;
  }

  public registerBroker(broker: BrokerHealth): void {
    this.brokers.set(broker.brokerId, broker);
  }

  public evaluatePartition(brokerId: string, nowMs: number = Date.now()): {
    isPartitioned: boolean;
    failoverRecommended: boolean;
    reason: string;
  } {
    const broker = this.brokers.get(brokerId);
    if (!broker) {
      return { isPartitioned: true, failoverRecommended: true, reason: 'Broker not registered' };
    }

    const elapsed = nowMs - broker.lastHeartbeatMs;
    if (elapsed > this.heartbeatTimeoutMs) {
      broker.isAlive = false;
      return {
        isPartitioned: true,
        failoverRecommended: true,
        reason: `Heartbeat timeout: ${elapsed}ms > ${this.heartbeatTimeoutMs}ms`
      };
    }

    if (broker.inSyncReplicasCount < this.minISR) {
      return {
        isPartitioned: true,
        failoverRecommended: true,
        reason: `ISR degraded: ${broker.inSyncReplicasCount} < minISR (${this.minISR})`
      };
    }

    return { isPartitioned: false, failoverRecommended: false, reason: 'Healthy' };
  }
}
