import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SnowflakeIdGeneratorService } from './arch-svc-21.service.ts';

describe('SnowflakeIdGeneratorService (ARCH-SVC-21)', () => {
  it('generates strictly monotonic 64-bit snowflake IDs', () => {
    const generator = new SnowflakeIdGeneratorService(5n);
    const id1 = generator.nextId();
    const id2 = generator.nextId();
    assert.ok(id2 > id1);
  });

  it('tolerates small NTP backward time jumps and preserves monotonicity', () => {
    const generator = new SnowflakeIdGeneratorService(1n);
    const t0 = 1710000000000n;
    const id1 = generator.nextId(t0);

    // Simulated 50ms NTP backwards jump
    const id2 = generator.nextId(t0 - 50n);
    assert.ok(id2 > id1);
  });

  it('rejects massive backward time shifts beyond tolerance', () => {
    const generator = new SnowflakeIdGeneratorService(1n);
    const t0 = 1710000000000n;
    generator.nextId(t0);

    assert.throws(() => {
      generator.nextId(t0 - 5000n);
    }, /Clock moved backwards/);
  });
});
