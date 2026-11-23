import { describe, it, expect } from 'vitest';
import {
  YjsBattleSyncDocument,
  RemoteCursor,
} from './yjs-battle-sync';

describe('YjsBattleSyncDocument (Vector Clocks & CRDT Collaborative Multi-Cursor Sync)', () => {
  it('converges deterministically when two clients edit at the same offset simultaneously', () => {
    // Both start with "const x = 1;"
    const initialCode = 'const x = 1;';
    const docA = new YjsBattleSyncDocument('client_A', initialCode);
    const docB = new YjsBattleSyncDocument('client_B', initialCode);

    // Both insert at index 6 simultaneously:
    // Client A inserts "let " -> "const let x = 1;"
    // Client B inserts "mut " -> "const mut x = 1;"
    const updateFromA = docA.localInsert(6, 'let ');
    const updateFromB = docB.localInsert(6, 'mut ');

    // Exchange updates cross-network
    docA.applyRemoteUpdate(updateFromB);
    docB.applyRemoteUpdate(updateFromA);

    // Both documents must converge to identical text without losing characters
    const textA = docA.getText();
    const textB = docB.getText();

    expect(textA).toBe(textB);
    expect(textA).toContain('let ');
    expect(textA).toContain('mut ');
    expect(textA.length).toBe(initialCode.length + 'let '.length + 'mut '.length);
  });

  it('generates compact binary payload under 60 bytes per single keystroke batch', () => {
    const doc = new YjsBattleSyncDocument('client_1');
    // Local insertion of 1 single keystroke 'a'
    const batch = doc.localInsert(0, 'a');

    const binary = doc.encodeUpdateBinary(batch);

    // Acceptance criteria: under 60 bytes per keystroke batch
    expect(binary.byteLength).toBeLessThan(60);

    // Verify round-trip decoding
    const decoded = doc.decodeUpdateBinary(binary);
    expect(decoded.clientId).toBe('client_1');
    expect(decoded.ops.length).toBe(1);
    expect(decoded.ops[0].char).toBe('a');
  });

  it('tracks remote multi-cursor positions and selections', () => {
    const doc = new YjsBattleSyncDocument('client_local');

    const remoteCursor: RemoteCursor = {
      userId: 'user_456',
      username: 'SarahDev',
      color: '#38bdf8',
      lineNumber: 14,
      column: 8,
      selection: {
        startLineNumber: 14,
        startColumn: 8,
        endLineNumber: 14,
        endColumn: 16,
      },
      lastActive: Date.now(),
    };

    doc.updateRemoteCursor(remoteCursor);

    const activeCursors = doc.getActiveRemoteCursors();
    expect(activeCursors.length).toBe(1);
    expect(activeCursors[0].username).toBe('SarahDev');
    expect(activeCursors[0].lineNumber).toBe(14);
    expect(activeCursors[0].selection?.endColumn).toBe(16);

    doc.removeRemoteCursor('user_456');
    expect(doc.getActiveRemoteCursors().length).toBe(0);
  });

  it('exchanges state vector for instant catch-up on reconnect', () => {
    const docA = new YjsBattleSyncDocument('client_A', 'hello');
    docA.localInsert(5, ' world');

    // Client B reconnects with empty / old state vector
    const clientBVector = { client_A: 5 }; // only has 'hello' (clock 5)
    const missing = docA.getMissingUpdatesSince(clientBVector);

    // Should return the characters for ' world' (6 characters)
    expect(missing.length).toBe(6);
    expect(missing.map((c) => c.char).join('')).toBe(' world');
  });
});
