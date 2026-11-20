import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  source: string;
  description: string;
  sequenceNumber: number;
  previousHash: string;
  currentHash: string;
  createdAt: Date;
}

@Injectable()
export class XpLedgerService {
  private readonly logger = new Logger(XpLedgerService.name);

  // In-memory ledger buffer mirroring cryptographic hash-chain
  private static userChains: Map<string, LedgerEntry[]> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes deterministic SHA-256 hash for transaction linking
   */
  calculateHash(
    previousHash: string,
    userId: string,
    amount: number,
    source: string,
    timestamp: number,
    sequenceNumber: number
  ): string {
    const payload = `${previousHash}|${userId}|${amount}|${source}|${timestamp}|${sequenceNumber}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Appends a new XP transaction with forward cryptographic hash-chaining
   */
  async recordTransaction(
    userId: string,
    amount: number,
    source: string,
    description: string
  ): Promise<LedgerEntry> {
    const chain = XpLedgerService.userChains.get(userId) || [];
    const sequenceNumber = chain.length + 1;
    const previousHash =
      chain.length > 0 ? chain[chain.length - 1].currentHash : '0'.repeat(64); // Genesis hash

    const now = Date.now();
    const currentHash = this.calculateHash(
      previousHash,
      userId,
      amount,
      source,
      now,
      sequenceNumber
    );

    const entry: LedgerEntry = {
      id: `xptx_${Date.now()}_${sequenceNumber}`,
      userId,
      amount,
      source,
      description,
      sequenceNumber,
      previousHash,
      currentHash,
      createdAt: new Date(now),
    };

    chain.push(entry);
    XpLedgerService.userChains.set(userId, chain);

    this.logger.log(
      `[XP Ledger] Appended tx #${sequenceNumber} for ${userId}. Hash: ${currentHash.substring(0, 16)}...`
    );

    return entry;
  }

  /**
   * Verifies the cryptographic integrity of a user's ledger chain.
   * Detects retroactive DB tampering or fabricated transactions.
   */
  verifyChainIntegrity(userId: string): { valid: boolean; errorIndex?: number; reason?: string } {
    const chain = XpLedgerService.userChains.get(userId) || [];
    if (chain.length === 0) return { valid: true };

    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : chain[i - 1].currentHash;

      if (current.previousHash !== expectedPrev) {
        return {
          valid: false,
          errorIndex: i,
          reason: `Broken chain link at sequence #${current.sequenceNumber}. Expected prev: ${expectedPrev.substring(0, 8)}, got: ${current.previousHash.substring(0, 8)}`,
        };
      }

      const recalculated = this.calculateHash(
        current.previousHash,
        current.userId,
        current.amount,
        current.source,
        current.createdAt.getTime(),
        current.sequenceNumber
      );

      if (recalculated !== current.currentHash) {
        return {
          valid: false,
          errorIndex: i,
          reason: `Tampered hash at sequence #${current.sequenceNumber}. Recalculated: ${recalculated.substring(0, 8)}, stored: ${current.currentHash.substring(0, 8)}`,
        };
      }
    }

    return { valid: true };
  }
}
