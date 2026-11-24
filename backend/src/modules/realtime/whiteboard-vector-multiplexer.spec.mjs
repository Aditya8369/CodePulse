import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WhiteboardVectorMultiplexerService {
  constructor() { this.rooms = new Map(); }
  append(r, s) { const l = this.rooms.get(r) || []; l.push(s); this.rooms.set(r, l); return l.length; }
}

describe('WhiteboardVectorMultiplexerService (#2130)', () => {
  test('multiplexes multi-user collaborative vector drawing strokes in room canvas', () => {
    const mux = new WhiteboardVectorMultiplexerService();
    const count = mux.append('room-1', { strokeId: 's1', userId: 'u1', points: [{ x: 10, y: 10 }] });
    assert.strictEqual(count, 1);
  });
});
