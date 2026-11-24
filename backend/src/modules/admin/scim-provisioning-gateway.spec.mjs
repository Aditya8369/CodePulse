import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ScimProvisioningGatewayService {
  constructor() { this.u = new Map(); }
  create(user) { this.u.set(user.id, { ...user }); return user; }
  deprovision(id) {
    const u = this.u.get(id);
    if (!u) return false;
    u.active = false;
    return true;
  }
  get(id) { return this.u.get(id); }
}

describe('ScimProvisioningGatewayService (#2386)', () => {
  test('provisions enterprise users and deactivates accounts upon deprovision webhook', () => {
    const gateway = new ScimProvisioningGatewayService();
    gateway.create({ id: 'usr-1', userName: 'alice@corp.com', active: true });
    assert.strictEqual(gateway.get('usr-1').active, true);

    const deproOk = gateway.deprovision('usr-1');
    assert.strictEqual(deproOk, true);
    assert.strictEqual(gateway.get('usr-1').active, false);
  });
});
