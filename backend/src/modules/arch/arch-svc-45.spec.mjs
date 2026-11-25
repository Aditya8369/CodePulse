import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventStreamReplayDebuggerService } from './arch-svc-45.service.ts';

describe('EventStreamReplayDebuggerService (ARCH-SVC-45)', () => {
  it('reconstructs historical application states up to specified target timestamp', () => {
    const replay = new EventStreamReplayDebuggerService();
    replay.recordEvent({ id: '1', timestamp: 100, type: 'INC', data: 5 });
    replay.recordEvent({ id: '2', timestamp: 200, type: 'INC', data: 10 });
    replay.recordEvent({ id: '3', timestamp: 300, type: 'INC', data: 20 });

    const stateAt150 = replay.reconstructStateAt(150, 0, (acc, ev) => acc + ev.data);
    assert.strictEqual(stateAt150, 5);

    const stateAt250 = replay.reconstructStateAt(250, 0, (acc, ev) => acc + ev.data);
    assert.strictEqual(stateAt250, 15);
  });
});
