/**
 * [OBS-CLOCK-SYNC-199]: Microsecond Timestamp Precision Clock Synchronization
 * Monotonic hardware clock calibrated against NTP offset to eliminate time skew.
 */

export interface ClockCalibration {
  ntpOffsetMicros: bigint;
  roundTripDelayMicros: bigint;
  lastCalibratedAt: number;
}

export class PrecisionClockSyncService {
  private ntpOffsetMicros: bigint = 0n;
  private readonly epochBaseMicros: bigint;
  private readonly hrStartBigInt: bigint;

  constructor() {
    this.epochBaseMicros = BigInt(Date.now()) * 1000n;
    this.hrStartBigInt = process.hrtime.bigint();
  }

  public calibrateWithNtpSample(t0Ms: number, tServerReceiveMs: number, tServerTransmitMs: number, t3Ms: number): ClockCalibration {
    // NTP Standard algorithm:
    // Offset = ((T1 - T0) + (T2 - T3)) / 2
    // Delay  = (T3 - T0) - (T2 - T1)
    const t0 = BigInt(Math.floor(t0Ms * 1000));
    const t1 = BigInt(Math.floor(tServerReceiveMs * 1000));
    const t2 = BigInt(Math.floor(tServerTransmitMs * 1000));
    const t3 = BigInt(Math.floor(t3Ms * 1000));

    const offset = ((t1 - t0) + (t2 - t3)) / 2n;
    const delay = (t3 - t0) - (t2 - t1);

    this.ntpOffsetMicros = offset;

    return {
      ntpOffsetMicros: offset,
      roundTripDelayMicros: delay,
      lastCalibratedAt: Date.now()
    };
  }

  public nowMicros(): bigint {
    const elapsedNanos = process.hrtime.bigint() - this.hrStartBigInt;
    const elapsedMicros = elapsedNanos / 1000n;
    return this.epochBaseMicros + elapsedMicros + this.ntpOffsetMicros;
  }

  public orderTelemetryEvents<T extends { timestampMicros: bigint }>(events: T[]): T[] {
    return [...events].sort((a, b) => {
      if (a.timestampMicros < b.timestampMicros) return -1;
      if (a.timestampMicros > b.timestampMicros) return 1;
      return 0;
    });
  }
}
