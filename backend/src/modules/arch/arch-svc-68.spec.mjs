import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CircularLogRingBufferService } from './arch-svc-68.service.ts';

describe('CircularLogRingBufferService (ARCH-SVC-68)', () => {
  it('buffers logs in bounded circular ring memory and dumps chronological sequences', () => {
    const ring = new CircularLogRingBufferService(3);
    ring.append('msg 1');
    ring.append('msg 2');
    ring.append('msg 3');
    ring.append('msg 4'); // evicts msg 1

    const dumped = ring.dumpDiagnosticLogs();
    assert.deepStrictEqual(dumped, ['msg 2', 'msg 3', 'msg 4']);
  });
});
