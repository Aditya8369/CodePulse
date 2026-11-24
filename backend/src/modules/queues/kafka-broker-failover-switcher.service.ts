import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KafkaBrokerFailoverSwitcherService {
  private readonly logger = new Logger(KafkaBrokerFailoverSwitcherService.name);
  private brokers: string[] = ['broker-1.kafka:9092', 'broker-2.kafka:9092', 'broker-3.kafka:9092'];
  private currentIdx = 0;
  private failedBrokers = new Set<string>();

  public getActiveBroker(): string {
    return this.brokers[this.currentIdx];
  }

  public reportBrokerFailure(broker: string): string {
    this.logger.warn(`Kafka broker unreachable: ${broker}. Switching to fallback route.`);
    this.failedBrokers.add(broker);

    for (let i = 0; i < this.brokers.length; i++) {
      const candidateIdx = (this.currentIdx + 1 + i) % this.brokers.length;
      if (!this.failedBrokers.has(this.brokers[candidateIdx])) {
        this.currentIdx = candidateIdx;
        return this.brokers[candidateIdx];
      }
    }

    // All reported failed, reset and rotate
    this.failedBrokers.clear();
    this.currentIdx = (this.currentIdx + 1) % this.brokers.length;
    return this.brokers[this.currentIdx];
  }
}
