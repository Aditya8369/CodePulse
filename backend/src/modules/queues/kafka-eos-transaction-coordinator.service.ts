import { Injectable, Logger } from '@nestjs/common';

export type TxState = 'INITIALIZED' | 'IN_FLIGHT' | 'COMMITTED' | 'ABORTED';

@Injectable()
export class KafkaEosTransactionCoordinatorService {
  private readonly logger = new Logger(KafkaEosTransactionCoordinatorService.name);
  private transactions = new Map<string, TxState>();

  public beginTransaction(txId: string): void {
    this.transactions.set(txId, 'IN_FLIGHT');
  }

  public commitTransaction(txId: string): { status: TxState; timestamp: number } {
    if (this.transactions.get(txId) !== 'IN_FLIGHT') {
      throw new Error(`Cannot commit transaction ${txId} not in flight`);
    }
    this.transactions.set(txId, 'COMMITTED');
    return { status: 'COMMITTED', timestamp: Date.now() };
  }

  public abortTransaction(txId: string): { status: TxState } {
    this.transactions.set(txId, 'ABORTED');
    return { status: 'ABORTED' };
  }

  public getStatus(txId: string): TxState {
    return this.transactions.get(txId) || 'INITIALIZED';
  }
}
