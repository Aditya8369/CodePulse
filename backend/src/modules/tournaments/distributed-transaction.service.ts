import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type TransactionPhase =
  | 'INIT'
  | 'PREPARING'
  | 'PREPARED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'ABORTING'
  | 'ABORTED';

export interface TwoPhaseParticipant {
  name: string;
  prepare(txId: string, context: Record<string, unknown>): Promise<boolean>;
  commit(txId: string): Promise<void>;
  rollback(txId: string): Promise<void>;
}

export interface TransactionJournalEntry {
  timestamp: number;
  phase: TransactionPhase;
  details?: string;
  error?: string;
}

export interface TransactionRecord {
  txId: string;
  tournamentId?: string;
  phase: TransactionPhase;
  participants: string[];
  preparedParticipants: string[];
  context: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  journal: TransactionJournalEntry[];
  error?: string;
}

export interface ExecuteTransactionOptions {
  tournamentId?: string;
  context: Record<string, unknown>;
  participants: TwoPhaseParticipant[];
  timeoutMs?: number;
}

export interface TransactionResult {
  txId: string;
  success: boolean;
  phase: TransactionPhase;
  error?: string;
  durationMs: number;
}

@Injectable()
export class DistributedTransactionCoordinator {
  private readonly logger = new Logger(DistributedTransactionCoordinator.name);
  private readonly transactions = new Map<string, TransactionRecord>();

  /**
   * Executes an ACID distributed transaction across registered participants using 2PC.
   */
  public async executeTransaction(
    options: ExecuteTransactionOptions
  ): Promise<TransactionResult> {
    const txId = `tx-${randomUUID()}`;
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 5000;

    const record: TransactionRecord = {
      txId,
      tournamentId: options.tournamentId,
      phase: 'INIT',
      participants: options.participants.map((p) => p.name),
      preparedParticipants: [],
      context: options.context,
      createdAt: startTime,
      updatedAt: startTime,
      journal: [
        {
          timestamp: startTime,
          phase: 'INIT',
          details: `Transaction initialized with ${options.participants.length} participants`,
        },
      ],
    };

    this.transactions.set(txId, record);

    try {
      // PHASE 1: PREPARE
      this.transitionPhase(record, 'PREPARING', 'Starting prepare phase across participants');
      
      const prepareTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Transaction prepare timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      );

      const prepareExecutions = options.participants.map(async (participant) => {
        const canPrepare = await Promise.race([
          participant.prepare(txId, options.context),
          prepareTimeoutPromise,
        ]);

        if (!canPrepare) {
          throw new Error(`Participant '${participant.name}' declined prepare phase`);
        }

        record.preparedParticipants.push(participant.name);
        return participant.name;
      });

      await Promise.all(prepareExecutions);
      this.transitionPhase(record, 'PREPARED', 'All participants prepared successfully');

      // PHASE 2: COMMIT
      this.transitionPhase(record, 'COMMITTING', 'Starting commit phase');
      const commitExecutions = options.participants.map((participant) =>
        participant.commit(txId)
      );

      await Promise.all(commitExecutions);
      this.transitionPhase(record, 'COMMITTED', 'All participants committed successfully');

      return {
        txId,
        success: true,
        phase: 'COMMITTED',
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Transaction ${txId} failed: ${errorMessage}`);
      record.error = errorMessage;

      // ROLLBACK PHASE: Abort all prepared participants
      this.transitionPhase(record, 'ABORTING', `Aborting transaction: ${errorMessage}`, errorMessage);
      await this.rollbackParticipants(record, options.participants);
      this.transitionPhase(record, 'ABORTED', 'Rollback completed for all prepared participants');

      return {
        txId,
        success: false,
        phase: 'ABORTED',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async rollbackParticipants(
    record: TransactionRecord,
    participants: TwoPhaseParticipant[]
  ): Promise<void> {
    const rollbackPromises = participants
      .filter((p) => record.preparedParticipants.includes(p.name))
      .map(async (p) => {
        try {
          await p.rollback(record.txId);
        } catch (rollbackErr) {
          this.logger.error(
            `Participant '${p.name}' failed rollback in ${record.txId}: ${rollbackErr}`
          );
        }
      });

    await Promise.allSettled(rollbackPromises);
  }

  private transitionPhase(
    record: TransactionRecord,
    nextPhase: TransactionPhase,
    details?: string,
    error?: string
  ): void {
    record.phase = nextPhase;
    record.updatedAt = Date.now();
    record.journal.push({
      timestamp: Date.now(),
      phase: nextPhase,
      details,
      error,
    });
  }

  public getTransaction(txId: string): TransactionRecord | undefined {
    return this.transactions.get(txId);
  }

  public getActiveTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter(
      (tx) => tx.phase !== 'COMMITTED' && tx.phase !== 'ABORTED'
    );
  }

  public getTransactionsByTournament(tournamentId: string): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter(
      (tx) => tx.tournamentId === tournamentId
    );
  }
}
