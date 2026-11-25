/**
 * Architecture Service 13: Distributed Transaction Coordinator (2PC Watchdog)
 * Subsystem: Two-Phase Commit Watchdog
 */

export type TxState = 'INITIALIZED' | 'PREPARING' | 'PREPARED' | 'COMMITTING' | 'COMMITTED' | 'ABORTED';

export interface Participant {
  id: string;
  vote?: 'COMMIT' | 'ABORT';
  preparedAt?: number;
  committed?: boolean;
}

export interface DistributedTx {
  txId: string;
  state: TxState;
  participants: Map<string, Participant>;
  timeoutMs: number;
  startTime: number;
}

export class TwoPhaseCommitWatchdogService {
  private transactions = new Map<string, DistributedTx>();

  public beginTransaction(txId: string, participantIds: string[], timeoutMs = 5000): DistributedTx {
    const participants = new Map<string, Participant>();
    for (const pid of participantIds) {
      participants.set(pid, { id: pid });
    }

    const tx: DistributedTx = {
      txId,
      state: 'INITIALIZED',
      participants,
      timeoutMs,
      startTime: Date.now(),
    };
    this.transactions.set(txId, tx);
    return tx;
  }

  public votePrepare(txId: string, participantId: string, vote: 'COMMIT' | 'ABORT'): TxState {
    const tx = this.transactions.get(txId);
    if (!tx) throw new Error('Transaction ' + txId + ' not found');
    if (tx.state === 'ABORTED') return 'ABORTED';

    tx.state = 'PREPARING';
    const participant = tx.participants.get(participantId);
    if (!participant) throw new Error('Participant ' + participantId + ' not enrolled');

    participant.vote = vote;
    participant.preparedAt = Date.now();

    if (vote === 'ABORT') {
      tx.state = 'ABORTED';
      return 'ABORTED';
    }

    const allVoted = Array.from(tx.participants.values()).every(p => p.vote !== undefined);
    if (allVoted) {
      const allCommit = Array.from(tx.participants.values()).every(p => p.vote === 'COMMIT');
      tx.state = allCommit ? 'PREPARED' : 'ABORTED';
    }
    return tx.state;
  }

  public commit(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state !== 'PREPARED') return false;

    tx.state = 'COMMITTING';
    for (const p of tx.participants.values()) {
      p.committed = true;
    }
    tx.state = 'COMMITTED';
    return true;
  }

  public checkWatchdog(currentTime = Date.now()): string[] {
    const timedOutTxIds: string[] = [];
    for (const [id, tx] of this.transactions.entries()) {
      if ((tx.state === 'INITIALIZED' || tx.state === 'PREPARING') && currentTime - tx.startTime > tx.timeoutMs) {
        tx.state = 'ABORTED';
        timedOutTxIds.push(id);
      }
    }
    return timedOutTxIds;
  }

  public getTransaction(txId: string): DistributedTx | undefined {
    return this.transactions.get(txId);
  }
}
