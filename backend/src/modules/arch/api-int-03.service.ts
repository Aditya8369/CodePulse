/**
 * Architecture Service 93: Webhook Delivery Engine
 * Subsystem: Exponential Jitter Retries & DLQ
 */

export interface WebhookDeliveryTask {
  id: string;
  targetUrl: string;
  payload: unknown;
  attempts: number;
  inDlq: boolean;
}

export class WebhookDeliveryEngineService {
  private queue: WebhookDeliveryTask[] = [];
  private readonly maxAttempts: number;

  constructor(maxAttempts = 3) {
    this.maxAttempts = maxAttempts;
  }

  public enqueueWebhook(id: string, targetUrl: string, payload: unknown): WebhookDeliveryTask {
    const task: WebhookDeliveryTask = {
      id,
      targetUrl,
      payload,
      attempts: 0,
      inDlq: false,
    };
    this.queue.push(task);
    return task;
  }

  public recordFailure(taskId: string): void {
    const task = this.queue.find(t => t.id === taskId);
    if (!task) return;
    task.attempts++;
    if (task.attempts >= this.maxAttempts) {
      task.inDlq = true;
    }
  }

  public getDlqTasks(): WebhookDeliveryTask[] {
    return this.queue.filter(t => t.inDlq);
  }
}
