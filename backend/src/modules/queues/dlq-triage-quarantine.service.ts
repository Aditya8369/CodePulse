export interface FailedMessage {
  id: string;
  topic: string;
  payload: string;
  errorReason: string;
  attemptCount: number;
}

export type TriageCategory = 'POISON_PILL' | 'TRANSIENT_RETRY' | 'FATAL_EXPIRED';

export interface TriageResult {
  messageId: string;
  category: TriageCategory;
  quarantined: boolean;
  scheduledNextRetryMs?: number;
}

export class DLQTriageQuarantineService {
  private quarantineStore: Map<string, FailedMessage> = new Map();
  private maxAttempts: number;

  constructor(maxAttempts: number = 5) {
    this.maxAttempts = maxAttempts;
  }

  public triage(message: FailedMessage): TriageResult {
    const errorLower = message.errorReason.toLowerCase();

    // 1. Poison-pill detection: syntax error, unparseable JSON, illegal token
    const isPoisonPill =
      errorLower.includes('syntaxerror') ||
      errorLower.includes('unexpected token') ||
      errorLower.includes('schemaviolation') ||
      errorLower.includes('malformed');

    if (isPoisonPill) {
      this.quarantineStore.set(message.id, message);
      return {
        messageId: message.id,
        category: 'POISON_PILL',
        quarantined: true
      };
    }

    // 2. Max attempts exceeded
    if (message.attemptCount >= this.maxAttempts) {
      this.quarantineStore.set(message.id, message);
      return {
        messageId: message.id,
        category: 'FATAL_EXPIRED',
        quarantined: true
      };
    }

    // 3. Transient error: calculate exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, message.attemptCount));
    const jitteredDelay = Math.floor(expDelay * (0.5 + Math.random() * 0.5));

    return {
      messageId: message.id,
      category: 'TRANSIENT_RETRY',
      quarantined: false,
      scheduledNextRetryMs: jitteredDelay
    };
  }

  public getQuarantinedCount(): number {
    return this.quarantineStore.size;
  }

  public getQuarantinedMessage(id: string): FailedMessage | undefined {
    return this.quarantineStore.get(id);
  }
}
