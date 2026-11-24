import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DbBufferPoolForecasterService {
  calc(deltaEvictions, deltaSec) {
    return Math.round(deltaEvictions / deltaSec);
  }
}

describe('DbBufferPoolForecasterService (#2158)', () => {
  test('forecasts buffer pool page eviction velocity per second', () => {
    const f = new DbBufferPoolForecasterService();
    assert.strictEqual(f.calc(500, 10), 50);
  });
});
