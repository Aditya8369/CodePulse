export class MonotonicClockSynchronizerService {
  private lastMonotonicUs: bigint = 0n;

  public nowMicros(): bigint {
    const hr = process.hrtime.bigint() / 1000n;
    if (hr <= this.lastMonotonicUs) {
      this.lastMonotonicUs += 1n; // Guarantee strict monotonicity
      return this.lastMonotonicUs;
    }
    this.lastMonotonicUs = hr;
    return hr;
  }
}
