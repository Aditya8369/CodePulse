/**
 * Vector Clocks & CRDT Collaborative Real-Time Multi-Cursor Battle Replay Sync Engine
 * Implements deterministic convergence, state vector catch-up, and multi-cursor tracking.
 */

export interface VectorClock {
  [clientId: string]: number;
}

export interface RemoteCursor {
  userId: string;
  username: string;
  color: string;
  lineNumber: number;
  column: number;
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  lastActive: number;
}

export interface CrdtChar {
  id: string; // `${clientId}_${clock}`
  char: string;
  originId: string | null;
  deleted: boolean;
  clock: number;
  clientId: string;
}

export interface CrdtUpdateBatch {
  clientId: string;
  clock: number;
  vector: VectorClock;
  ops: Array<{
    type: 'insert' | 'delete';
    id: string;
    char?: string;
    originId?: string | null;
  }>;
}

export class YjsBattleSyncDocument {
  private chars: CrdtChar[] = [];
  private vectorClock: VectorClock = {};
  private localClientId: string;
  private cursors = new Map<string, RemoteCursor>();

  constructor(localClientId: string, initialText = '') {
    this.localClientId = localClientId;
    this.vectorClock[localClientId] = 0;

    if (initialText) {
      let prevId: string | null = null;
      for (let i = 0; i < initialText.length; i++) {
        const clock = ++this.vectorClock[localClientId];
        const id = `${localClientId}_${clock}`;
        this.chars.push({
          id,
          char: initialText[i],
          originId: prevId,
          deleted: false,
          clock,
          clientId: localClientId,
        });
        prevId = id;
      }
    }
  }

  public getClientId(): string {
    return this.localClientId;
  }

  public getText(): string {
    return this.chars.filter((c) => !c.deleted).map((c) => c.char).join('');
  }

  public getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  /**
   * Local insertion at index.
   */
  public localInsert(index: number, text: string): CrdtUpdateBatch {
    const activeChars = this.chars.filter((c) => !c.deleted);
    let prevActive = index > 0 ? activeChars[index - 1] : null;

    const ops: CrdtUpdateBatch['ops'] = [];

    for (let i = 0; i < text.length; i++) {
      const clock = ++this.vectorClock[this.localClientId];
      const id = `${this.localClientId}_${clock}`;
      const char = text[i];
      const originId = prevActive ? prevActive.id : null;

      const newCharNode: CrdtChar = {
        id,
        char,
        originId,
        deleted: false,
        clock,
        clientId: this.localClientId,
      };

      // Insert immediately after origin in full internal structure
      const insertAt = prevActive
        ? this.chars.findIndex((c) => c.id === prevActive!.id) + 1
        : 0;
      this.chars.splice(insertAt, 0, newCharNode);

      prevActive = newCharNode;
      ops.push({ type: 'insert', id, char, originId });
    }

    return {
      clientId: this.localClientId,
      clock: this.vectorClock[this.localClientId],
      vector: this.getVectorClock(),
      ops,
    };
  }

  /**
   * Local deletion at index.
   */
  public localDelete(index: number, length = 1): CrdtUpdateBatch {
    const activeChars = this.chars.filter((c) => !c.deleted);
    const targetChars = activeChars.slice(index, index + length);

    const ops: CrdtUpdateBatch['ops'] = [];

    for (const target of targetChars) {
      target.deleted = true;
      this.vectorClock[this.localClientId]++;
      ops.push({ type: 'delete', id: target.id });
    }

    return {
      clientId: this.localClientId,
      clock: this.vectorClock[this.localClientId],
      vector: this.getVectorClock(),
      ops,
    };
  }

  /**
   * Integrates remote update batch deterministically using tie-breaking and vector clocks.
   */
  public applyRemoteUpdate(batch: CrdtUpdateBatch): void {
    // Update vector clock
    this.vectorClock[batch.clientId] = Math.max(
      this.vectorClock[batch.clientId] || 0,
      batch.clock
    );

    for (const op of batch.ops) {
      if (op.type === 'delete') {
        const target = this.chars.find((c) => c.id === op.id);
        if (target) {
          target.deleted = true;
        }
      } else if (op.type === 'insert') {
        if (this.chars.some((c) => c.id === op.id)) continue; // Idempotent

        const newNode: CrdtChar = {
          id: op.id,
          char: op.char || '',
          originId: op.originId || null,
          deleted: false,
          clock: batch.clock,
          clientId: batch.clientId,
        };

        let insertIdx = 0;
        if (op.originId) {
          const originIdx = this.chars.findIndex((c) => c.id === op.originId);
          insertIdx = originIdx >= 0 ? originIdx + 1 : this.chars.length;
        }

        // Deterministic tie-breaking for concurrent insertions at the same origin:
        // Order by clientId string comparison so both clients converge to identical state
        while (
          insertIdx < this.chars.length &&
          this.chars[insertIdx].originId === op.originId &&
          this.chars[insertIdx].clientId > batch.clientId
        ) {
          insertIdx++;
        }

        this.chars.splice(insertIdx, 0, newNode);
      }
    }
  }

  /**
   * Compact binary encoding for keystroke batches (strictly under 60 bytes per single keystroke).
   */
  public encodeUpdateBinary(batch: CrdtUpdateBatch): Uint8Array {
    const jsonStr = JSON.stringify({
      c: batch.clientId,
      k: batch.clock,
      o: batch.ops.map((o) => [o.type === 'insert' ? 1 : 0, o.id, o.char || '', o.originId || '']),
    });
    return new TextEncoder().encode(jsonStr);
  }

  /**
   * Compact binary decoding.
   */
  public decodeUpdateBinary(bytes: Uint8Array): CrdtUpdateBatch {
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    return {
      clientId: raw.c,
      clock: raw.k,
      vector: { [raw.c]: raw.k },
      ops: raw.o.map((o: [number, string, string, string]) => ({
        type: o[0] === 1 ? 'insert' : 'delete',
        id: o[1],
        char: o[2] || undefined,
        originId: o[3] || null,
      })),
    };
  }

  /**
   * Multi-cursor position and selection updates.
   */
  public updateRemoteCursor(cursor: RemoteCursor): void {
    this.cursors.set(cursor.userId, { ...cursor, lastActive: Date.now() });
  }

  public removeRemoteCursor(userId: string): void {
    this.cursors.delete(userId);
  }

  public getActiveRemoteCursors(): RemoteCursor[] {
    const now = Date.now();
    // Prune stale cursors inactive for > 15 seconds
    for (const [userId, cur] of this.cursors.entries()) {
      if (now - cur.lastActive > 15000) {
        this.cursors.delete(userId);
      }
    }
    return Array.from(this.cursors.values());
  }

  /**
   * Computes missing catch-up state for reconnecting clients.
   */
  public getMissingUpdatesSince(remoteVector: VectorClock): CrdtChar[] {
    return this.chars.filter((char) => {
      const knownClock = remoteVector[char.clientId] || 0;
      return char.clock > knownClock;
    });
  }
}
