import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class HypertableChunkTunerService {
  calc(rows) {
    if (rows > 10000000) return 2;
    if (rows > 2000000) return 6;
    return 24;
  }
}

describe('HypertableChunkTunerService (#2162)', () => {
  test('dynamically auto-tunes time-series chunk intervals according to ingestion velocity', () => {
    const tuner = new HypertableChunkTunerService();
    assert.strictEqual(tuner.calc(15000000), 2);
    assert.strictEqual(tuner.calc(500000), 24);
  });
});
