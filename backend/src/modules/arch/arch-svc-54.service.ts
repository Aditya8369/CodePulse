/**
 * Architecture Service 54: Event-Driven Audit Trail Accumulator
 * Subsystem: Cryptographically Chained Blocks
 */

import crypto from 'node:crypto';

export interface AuditBlock<T = unknown> {
  index: number;
  timestamp: number;
  data: T;
  previousHash: string;
  hash: string;
}

export class CryptographicAuditTrailService {
  private chain: AuditBlock[] = [];

  constructor() {
    // Initialize Genesis Block
    const genesis: AuditBlock<string> = {
      index: 0,
      timestamp: 1704067200000,
      data: 'GENESIS_AUDIT_BLOCK',
      previousHash: '0'.repeat(64),
      hash: this.calculateHash(0, 1704067200000, 'GENESIS_AUDIT_BLOCK', '0'.repeat(64)),
    };
    this.chain.push(genesis);
  }

  public appendEvent<T>(data: T): AuditBlock<T> {
    const prev = this.chain[this.chain.length - 1];
    const index = prev.index + 1;
    const timestamp = Date.now();
    const hash = this.calculateHash(index, timestamp, data, prev.hash);

    const block: AuditBlock<T> = {
      index,
      timestamp,
      data,
      previousHash: prev.hash,
      hash,
    };
    this.chain.push(block);
    return block;
  }

  public verifyIntegrity(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const prev = this.chain[i - 1];

      if (current.previousHash !== prev.hash) {
        return false;
      }
      const expectedHash = this.calculateHash(current.index, current.timestamp, current.data, current.previousHash);
      if (current.hash !== expectedHash) {
        return false;
      }
    }
    return true;
  }

  private calculateHash(index: number, timestamp: number, data: unknown, prevHash: string): string {
    const raw = index + ':' + timestamp + ':' + JSON.stringify(data) + ':' + prevHash;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public get blockCount(): number {
    return this.chain.length;
  }
}
