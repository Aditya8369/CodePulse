import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GracefulReloadSupervisorService } from './arch-svc-86.service.ts';

describe('GracefulReloadSupervisorService (ARCH-SVC-86)', () => {
  it('drains active sockets during reload and stops admitting new sockets', () => {
    const supervisor = new GracefulReloadSupervisorService();
    supervisor.registerSocket('sock-1');
    supervisor.registerSocket('sock-2');

    assert.strictEqual(supervisor.pendingSocketCount, 2);

    supervisor.beginGracefulReload();
    assert.strictEqual(supervisor.registerSocket('sock-3'), false); // blocked during reload

    supervisor.closeSocket('sock-1');
    assert.strictEqual(supervisor.pendingSocketCount, 1);
  });
});
