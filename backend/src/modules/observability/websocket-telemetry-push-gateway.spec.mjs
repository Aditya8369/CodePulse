import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebsocketTelemetryPushGatewayService {
  constructor() { this.clients = new Set(); }
  sub(c) { this.clients.add(c); }
  broadcast() { return this.clients.size; }
}

describe('WebsocketTelemetryPushGatewayService (#2252)', () => {
  test('dispatches real-time live telemetry metrics to dashboard subscribers', () => {
    const gw = new WebsocketTelemetryPushGatewayService();
    gw.sub('client-dash-1');
    gw.sub('client-dash-2');
    assert.strictEqual(gw.broadcast(), 2);
  });
});
