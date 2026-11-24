import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GeoDNSFailoverControllerService {
  resolveDNSTarget(client, status) {
    if (status[client] && status[client].healthy) return client;
    let best = '';
    let minLat = Infinity;
    for (const [r, s] of Object.entries(status)) {
      if (s.healthy && s.latencyMs < minLat) { minLat = s.latencyMs; best = r; }
    }
    return best;
  }
}

describe('GeoDNSFailoverControllerService (Issue #1889)', () => {
  it('should steer traffic to nearest healthy geographical cluster during regional brownouts', () => {
    const controller = new GeoDNSFailoverControllerService();
    const status = {
      'us-west': { healthy: false, latencyMs: 20 },
      'us-east': { healthy: true, latencyMs: 60 },
      'eu-west': { healthy: true, latencyMs: 140 }
    };

    assert.equal(controller.resolveDNSTarget('us-west', status), 'us-east');
  });
});
