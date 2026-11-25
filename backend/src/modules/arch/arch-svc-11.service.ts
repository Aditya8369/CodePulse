/**
 * Architecture Service 11: Actor Model Supervision Tree
 * Subsystem: Isolated Code Evaluation Tasks
 */

export interface ActorMessage<T = unknown> {
  id: string;
  sender: string;
  targetActorId: string;
  payload: T;
  timestamp: number;
}

export interface ActorContext {
  id: string;
  state: 'STARTING' | 'RUNNING' | 'FAILED' | 'RESTARTING' | 'STOPPED';
  restartCount: number;
  lastRestartTimestamp: number;
  maxRestarts: number;
  restartWindowMs: number;
  deadLetterCount: number;
}

export type SupervisionStrategy = 'ONE_FOR_ONE' | 'ALL_FOR_ONE';

export class ActorModelSupervisionTreeService {
  private actors = new Map<string, ActorContext>();
  private mailboxes = new Map<string, ActorMessage[]>();
  private deadLetterQueue: ActorMessage[] = [];
  private strategy: SupervisionStrategy = 'ONE_FOR_ONE';

  constructor(strategy: SupervisionStrategy = 'ONE_FOR_ONE') {
    this.strategy = strategy;
  }

  public registerActor(id: string, maxRestarts = 3, restartWindowMs = 30000): ActorContext {
    const context: ActorContext = {
      id,
      state: 'RUNNING',
      restartCount: 0,
      lastRestartTimestamp: 0,
      maxRestarts,
      restartWindowMs,
      deadLetterCount: 0,
    };
    this.actors.set(id, context);
    this.mailboxes.set(id, []);
    return { ...context };
  }

  public sendMessage(message: ActorMessage): boolean {
    const actor = this.actors.get(message.targetActorId);
    if (!actor || actor.state === 'STOPPED' || actor.state === 'FAILED') {
      this.deadLetterQueue.push(message);
      if (actor) actor.deadLetterCount++;
      return false;
    }
    const mailbox = this.mailboxes.get(message.targetActorId) || [];
    mailbox.push(message);
    this.mailboxes.set(message.targetActorId, mailbox);
    return true;
  }

  public handleActorFailure(actorId: string, error: Error): 'RESTARTED' | 'ESCALATED' {
    const actor = this.actors.get(actorId);
    if (!actor) throw new Error('Actor ' + actorId + ' not found');

    const now = Date.now();
    if (now - actor.lastRestartTimestamp > actor.restartWindowMs) {
      actor.restartCount = 0;
    }

    actor.restartCount++;
    actor.lastRestartTimestamp = now;

    if (actor.restartCount > actor.maxRestarts) {
      actor.state = 'STOPPED';
      if (this.strategy === 'ALL_FOR_ONE') {
        for (const [id, ctx] of this.actors.entries()) {
          ctx.state = 'STOPPED';
        }
      }
      return 'ESCALATED';
    }

    actor.state = 'RESTARTING';
    const mailbox = this.mailboxes.get(actorId) || [];
    this.mailboxes.set(actorId, mailbox);
    actor.state = 'RUNNING';

    if (this.strategy === 'ALL_FOR_ONE') {
      for (const [id, ctx] of this.actors.entries()) {
        if (id !== actorId && ctx.state === 'RUNNING') {
          ctx.state = 'RESTARTING';
          ctx.state = 'RUNNING';
        }
      }
    }

    return 'RESTARTED';
  }

  public getActor(id: string): ActorContext | undefined {
    const ctx = this.actors.get(id);
    return ctx ? { ...ctx } : undefined;
  }

  public getDeadLetters(): ActorMessage[] {
    return [...this.deadLetterQueue];
  }

  public getQueueLength(actorId: string): number {
    return (this.mailboxes.get(actorId) || []).length;
  }
}
