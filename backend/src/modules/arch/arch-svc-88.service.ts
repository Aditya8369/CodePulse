/**
 * Architecture Service 88: Distributed System Chaos Injection Hook
 * Subsystem: Network Latency and Packet Drops Simulation
 */

export class ChaosInjectionHookService {
  private dropRate = 0; // 0.0 to 1.0

  public setDropRate(rate: number): void {
    this.dropRate = Math.max(0, Math.min(1, rate));
  }

  public shouldDropPacket(): boolean {
    if (this.dropRate <= 0) return false;
    return Math.random() < this.dropRate;
  }
}
