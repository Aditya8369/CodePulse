export type TxState = 'PREPARED' | 'COMMITTED' | 'ABORTED';

export interface TxRecord {
  txId: string;
  idempotencyKey: string;
  state: TxState;
  preparedAtMs: number;
  payload: any;
}

export class ExactlyOncePipelineService {
  private transactions = new Map<string, TxRecord>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> txId

  public prepare(txId: string, idempotencyKey: string, payload: any): { success: boolean; state: TxState } {
    if (this.idempotencyIndex.has(idempotencyKey)) {
      const existingTxId = this.idempotencyIndex.get(idempotencyKey)!;
      const existingTx = this.transactions.get(existingTxId)!;
      return { success: existingTx.state === 'COMMITTED', state: existingTx.state };
    }

    const record: TxRecord = {
      txId,
      idempotencyKey,
      state: 'PREPARED',
      preparedAtMs: Date.now(),
      payload
    };

    this.transactions.set(txId, record);
    this.idempotencyIndex.set(idempotencyKey, txId);
    return { success: true, state: 'PREPARED' };
  }

  public commit(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state === 'ABORTED') {
      return false;
    }
    tx.state = 'COMMITTED';
    return true;
  }

  public abort(txId: string): boolean {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state === 'COMMITTED') {
      return false;
    }
    tx.state = 'ABORTED';
    return true;
  }

  public getTransaction(txId: string): TxRecord | undefined {
    return this.transactions.get(txId);
  }
}
