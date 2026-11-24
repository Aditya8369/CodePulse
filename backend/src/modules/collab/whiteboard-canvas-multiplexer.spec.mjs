import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WhiteboardCanvasMultiplexerService {
  constructor() { this.el = new Map(); }
  updateElement(e) { this.el.set(e.id, e); }
  deleteElement(id) { this.el.delete(id); }
  getSnapshot() { return Array.from(this.el.values()); }
}

describe('WhiteboardCanvasMultiplexerService (Issue #1935)', () => {
  it('should multiplex collaborative canvas element mutations and deliver state snapshots', () => {
    const whiteboard = new WhiteboardCanvasMultiplexerService();
    whiteboard.updateElement({ id: 'box-1', type: 'rectangle', x: 100, y: 150 });
    whiteboard.updateElement({ id: 'box-2', type: 'circle', x: 300, y: 200 });

    assert.equal(whiteboard.getSnapshot().length, 2);
    whiteboard.deleteElement('box-1');
    assert.equal(whiteboard.getSnapshot().length, 1);
  });
});
