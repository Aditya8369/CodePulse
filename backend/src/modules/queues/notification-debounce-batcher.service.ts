import { Injectable, Logger } from '@nestjs/common';

export interface QueuedNotification<T = unknown> {
  recipientId: string;
  payload: T;
  receivedAt: number;
}

@Injectable()
export class NotificationDebounceBatcherService<T = unknown> {
  private readonly logger = new Logger(NotificationDebounceBatcherService.name);
  private userBuffers = new Map<string, QueuedNotification<T>[]>();
  private readonly maxBatchSize = 50;

  public addNotification(recipientId: string, payload: T): { bufferedCount: number; flushNow: boolean } {
    let buffer = this.userBuffers.get(recipientId) || [];
    buffer.push({ recipientId, payload, receivedAt: Date.now() });
    this.userBuffers.set(recipientId, buffer);

    const flushNow = buffer.length >= this.maxBatchSize;
    return { bufferedCount: buffer.length, flushNow };
  }

  public flush(recipientId: string): QueuedNotification<T>[] {
    const list = this.userBuffers.get(recipientId) || [];
    this.userBuffers.delete(recipientId);
    return list;
  }
}
