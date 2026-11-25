/**
 * Architecture Service 29: Automated Dead-Letter Queue Reprocessor
 * Subsystem: Exponential Jitter Retries
 */

export interface DlqMessage<T = unknown> {
  id: string;
  payload: T;
  retryCount: number;
  lastAttemptAt: number;
  errorReason: string;
}

export class AutomatedDlqReprocessorService {
  private dlq: DlqMessage[] = [];

  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxRetries: number;

  constructor(
    baseBackoffMs = 1000,
    maxBackoffMs = 30000,
    maxRetries = 5
  ) {
    this.baseBackoffMs = baseBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.maxRetries = maxRetries;
  }

  public pushToDlq(id: string, payload: unknown, reason: string): DlqMessage {
    const msg: DlqMessage = {
      id,
      payload,
      retryCount: 0,
      lastAttemptAt: Date.now(),
      errorReason: reason,
    };
    this.dlq.push(msg);
    return msg;
  }

  public calculateBackoffDelay(retryCount: number): number {
    const exponential = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, retryCount));
    // Full jitter between 50% and 100% of exponential delay
    const jittered = exponential * (0.5 + Math.random() * 0.5);
    return Math.floor(jittered);
  }

  public getPendingRetries(currentTime = Date.now()): DlqMessage[] {
    return this.dlq.filter(m => {
      if (m.retryCount >= this.maxRetries) return false;
      const delay = this.calculateBackoffDelay(m.retryCount);
      return currentTime - m.lastAttemptAt >= delay;
    });
  }
}
