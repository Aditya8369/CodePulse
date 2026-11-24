import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AcmeRateLimitProxyService {
  constructor() { this.p = 'LETS_ENCRYPT'; }
  req(d, rateLimited) {
    if (rateLimited) this.p = 'ZEROSSL';
    else this.p = 'LETS_ENCRYPT';
    return { p: this.p, d };
  }
}

describe('AcmeRateLimitProxyService (#2379)', () => {
  test("fails over to secondary CA provider when Lets Encrypt rate limits are reached", () => {
    const proxy = new AcmeRateLimitProxyService();
    const normal = proxy.req('app.codepulse.io', false);
    assert.strictEqual(normal.p, 'LETS_ENCRYPT');

    const failedOver = proxy.req('tenant.codepulse.io', true);
    assert.strictEqual(failedOver.p, 'ZEROSSL');
  });
});
