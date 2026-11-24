import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

class VirtualTopicIsolatorService {
  constructor(secret = 'test-secret') { this.secret = secret; }
  generateTenantToken(tenantId) {
    return crypto.createHmac('sha256', this.secret).update('tenant:' + tenantId).digest('hex');
  }
  resolvePhysicalTopic(virtualTopic, tenantId, token) {
    if (token !== this.generateTenantToken(tenantId)) {
      return { authorized: false, physicalTopicName: null };
    }
    return { authorized: true, physicalTopicName: 'cp.' + tenantId + '.' + virtualTopic };
  }
}

describe('VirtualTopicIsolatorService (Issue #1805)', () => {
  it('should authenticate tenant tokens with HMAC-SHA256 and isolate physical topic namespaces', () => {
    const isolator = new VirtualTopicIsolatorService('top-secret-key');
    const validToken = isolator.generateTenantToken('acme-corp');

    const authorized = isolator.resolvePhysicalTopic('battle.events', 'acme-corp', validToken);
    assert.equal(authorized.authorized, true);
    assert.equal(authorized.physicalTopicName, 'cp.acme-corp.battle.events');

    const unauthorized = isolator.resolvePhysicalTopic('battle.events', 'acme-corp', 'tampered-token');
    assert.equal(unauthorized.authorized, false);
    assert.equal(unauthorized.physicalTopicName, null);
  });
});
