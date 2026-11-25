/**
 * Architecture Service 78: Real-Time Distributed Counter Service
 * Subsystem: Probabilistic Counting (HyperLogLog)
 */

export class HyperLogLogCounterService {
  private registers = new Uint8Array(64); // 64 registers for compact test

  public add(item: string): void {
    let hash = 0;
    for (let i = 0; i < item.length; i++) {
      hash = ((hash << 5) - hash + item.charCodeAt(i)) | 0;
    }
    const regIdx = Math.abs(hash) % 64;
    const leadingZeros = Math.min(32, Math.clz32(hash) + 1);

    if (leadingZeros > this.registers[regIdx]) {
      this.registers[regIdx] = leadingZeros;
    }
  }

  public estimateCardinality(): number {
    let sum = 0;
    for (let i = 0; i < 64; i++) {
      sum += Math.pow(2, -this.registers[i]);
    }
    const alpha = 0.709;
    const rawEstimate = (alpha * 64 * 64) / sum;
    return Math.round(rawEstimate);
  }
}
