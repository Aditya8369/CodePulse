import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class OfflineLicenseValidatorService {
  sign(t, tier, seats, exp, key) {
    return crypto.createHmac('sha256', key).update(`${t}:${tier}:${seats}:${exp}`).digest('hex');
  }
  validate(lic, key, now) {
    if (lic.exp <= now) return false;
    const expSig = this.sign(lic.t, lic.tier, lic.seats, lic.exp, key);
    return lic.sig === expSig;
  }
}

describe('OfflineLicenseValidatorService (#2391)', () => {
  test('validates cryptographic HMAC signatures on offline enterprise license leases', () => {
    const validator = new OfflineLicenseValidatorService();
    const key = 'secret_master_key';
    const exp = 5000;
    const sig = validator.sign('acme', 'ENTERPRISE', 100, exp, key);

    assert.strictEqual(validator.validate({ t: 'acme', tier: 'ENTERPRISE', seats: 100, exp, sig }, key, 1000), true);
    assert.strictEqual(validator.validate({ t: 'acme', tier: 'ENTERPRISE', seats: 100, exp, sig }, key, 6000), false); // Expired
  });
});
