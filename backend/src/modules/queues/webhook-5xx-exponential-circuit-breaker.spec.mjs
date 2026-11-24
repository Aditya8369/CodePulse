import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class Webhook5xxExponentialCircuitBreakerService {
  constructor() { this.c = new Map(); }
  rec(ep, code) {
    let s = this.c.get(ep) || { open: false, errs: 0, cd: 0 };
    if (code >= 500) {
      s.errs++;
      const backoffSec = Math.pow(2, s.errs);
      s.cd = Date.now() + (backoffSec * 1000);
      s.open = true;
    } else {
      s.errs = 0;
      s.open = false;
      s.cd = 0;
    }
    this.c.set(ep, s);
    return s;
  }
  can(ep) {
    const s = this.c.get(ep);
    if (!s || !s.open) return true;
    return Date.now() >= s.cd;
  }
}

describe('Webhook5xxExponentialCircuitBreakerService (#2299)', () => {
  test('trips circuit upon 5xx responses with exponential cooldown periods', () => {
    const cb = new Webhook5xxExponentialCircuitBreakerService();
    const ep = 'https://api.partner.com/webhook';
    assert.strictEqual(cb.can(ep), true);

    cb.rec(ep, 502);
    assert.strictEqual(cb.can(ep), false);

    cb.rec(ep, 200);
    assert.strictEqual(cb.can(ep), true);
  });
});
