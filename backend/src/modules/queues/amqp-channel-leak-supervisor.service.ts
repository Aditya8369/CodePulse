import { Injectable, Logger } from '@nestjs/common';

export interface ChannelRecord {
  channelId: string;
  openedAt: number;
  lastActive: number;
}

@Injectable()
export class AmqpChannelLeakSupervisorService {
  private readonly logger = new Logger(AmqpChannelLeakSupervisorService.name);
  private channels = new Map<string, ChannelRecord>();

  public registerChannel(channelId: string): void {
    this.channels.set(channelId, {
      channelId,
      openedAt: Date.now(),
      lastActive: Date.now(),
    });
  }

  public touchChannel(channelId: string): void {
    const ch = this.channels.get(channelId);
    if (ch) ch.lastActive = Date.now();
  }

  public closeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  public sweepLeakedChannels(idleTimeoutMs = 30000): { closedCount: number; closedIds: string[] } {
    const now = Date.now();
    const closedIds: string[] = [];

    for (const [id, ch] of this.channels.entries()) {
      if (now - ch.lastActive > idleTimeoutMs) {
        closedIds.push(id);
        this.channels.delete(id);
        this.logger.warn(`Closed leaked AMQP channel ${id} after ${now - ch.lastActive}ms idle`);
      }
    }

    return { closedCount: closedIds.length, closedIds };
  }
}
