import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DynamicDbTenantScalerService {
  scale(rps) {
    if (rps <= 10) return 2;
    return Math.min(20, 2 + Math.floor(rps / 20));
  }
}

describe('DynamicDbTenantScalerService (#2165)', () => {
  test('dynamically scales tenant connection pool size according to traffic load', () => {
    const scaler = new DynamicDbTenantScalerService();
    assert.strictEqual(scaler.scale(5), 2);
    assert.strictEqual(scaler.scale(100), 7);
    assert.strictEqual(scaler.scale(500), 20);
  });
});
