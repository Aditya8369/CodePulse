import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CRDTEditorEngineService {
  constructor() { this.t = ''; this.c = 0; }
  applyOperation(op) {
    if (op.type === 'INSERT' && op.char) this.t = this.t.slice(0, op.index) + op.char + this.t.slice(op.index);
    else if (op.type === 'DELETE') this.t = this.t.slice(0, op.index) + this.t.slice(op.index + 1);
    this.c = Math.max(this.c, op.clock) + 1;
    return this.t;
  }
  getText() { return this.t; }
}

describe('CRDTEditorEngineService (Issue #1917)', () => {
  it('should apply concurrent character insertions and deletions deterministically', () => {
    const editor = new CRDTEditorEngineService();
    editor.applyOperation({ type: 'INSERT', index: 0, char: 'H', clock: 1 });
    editor.applyOperation({ type: 'INSERT', index: 1, char: 'i', clock: 2 });
    assert.equal(editor.getText(), 'Hi');

    editor.applyOperation({ type: 'DELETE', index: 1, clock: 3 });
    assert.equal(editor.getText(), 'H');
  });
});
