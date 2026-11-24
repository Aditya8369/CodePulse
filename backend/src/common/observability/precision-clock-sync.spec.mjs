import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PrecisionClockSyncService {
  constructor() {
    this.epochBaseMicros = BigInt(Date.now()) * 1000n;
    this.hrStartBigInt = process.hrtime.bigint();
    this.ntpOffsetMicros = 0n;
  }

  calibrateWithNtpSample(t0Ms, t1Ms, t2Ms, t3Ms) {
    const t0 = BigInt(Math.floor(t0Ms * 1000));
    const t1 = BigInt(Math.floor(t1Ms * 1000));
    const t2 = BigInt(Math.floor(t2Ms * 1000));
    const t3 = BigInt(Math.floor(t3Ms * 1000));
    const offset = ((t1 - t0) + (t2 - t3)) / 2n;
    const delay = (t3 - t0) - (t2 - t1);
    this.ntpOffsetMicros = offset;
    return { ntpOffsetMicros: offset, roundTripDelayMicros: delay };
  }

  nowMicros() {
    const elapsedNanos = process.hrtime.bigint() - this.hrStartBigInt;
    const elapsedMicros = elapsedNanos / 1000n;
    return this.epochBaseMicros + elapsedMicros + this.ntpOffsetMicros;
  }

  orderTelemetryEvents(events) {
    return [...events].sort((a, b) => (a.timestampMicros < b.timestampMicros ? -1 : 1));
  }
}

describe('PrecisionClockSyncService (Issue #1478)', () => {
  it('should calibrate clock with NTP sample and calculate offset', () => {
    const clock = new PrecisionClockSyncService();
    // Simulate client sent at 1000ms, server received at 1020ms, server replied at 1025ms, client received at 1050ms
    const calibration = clock.calibrateWithNtpSample(1000, 1020, 1025, 1050);
    assert.ok(calibration.roundTripDelayMicros > 0n);
  });

  it('should generate monotonically advancing microsecond timestamps', async () => {
    const clock = new PrecisionClockSyncService();
    const t1 = clock.nowMicros();
    await new Promise(r => setTimeout(r, 5));
    const t2 = clock.nowMicros();
    assert.ok(t2 > t1, 'Next timestamp must strictly advance');
  });

  it('should accurately order distributed telemetry events without time-skew', () => {
    const clock = new PrecisionClockSyncService();
    const events = [
      { id: 'ev3', timestampMicros: 3000n },
      { id: 'ev1', timestampMicros: 1000n },
      { id: 'ev2', timestampMicros: 2000n }
    ];
    const ordered = clock.orderTelemetryEvents(events);
    assert.deepEqual(ordered.map(e => e.id), ['ev1', 'ev2', 'ev3']);
  });
});
