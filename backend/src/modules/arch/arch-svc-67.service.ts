/**
 * Architecture Service 67: Microservice Transaction Boundary Validator
 * Subsystem: Domain Event Atomicity
 */

export interface TransactionalContext {
  txId: string;
  hasOpenTransaction: boolean;
  registeredEvents: string[];
}

export class TransactionBoundaryValidatorService {
  public validateEventDispatch(ctx: TransactionalContext, eventName: string): void {
    if (!ctx.hasOpenTransaction) {
      throw new Error('Illegal event dispatch: Event ' + eventName + ' must be dispatched within an active transaction');
    }
    ctx.registeredEvents.push(eventName);
  }
}
