import { Injectable, Logger } from '@nestjs/common';

export interface ProgressBroadcast {
  jobId: string;
  progressPercent: number;
  stage: string;
  subscribersNotified: number;
}

@Injectable()
export class BullmqProgressWebsocketGatewayService {
  private readonly logger = new Logger(BullmqProgressWebsocketGatewayService.name);
  private roomSubscriptions = new Map<string, Set<string>>();

  public subscribe(jobId: string, socketId: string): void {
    let subs = this.roomSubscriptions.get(jobId);
    if (!subs) {
      subs = new Set<string>();
      this.roomSubscriptions.set(jobId, subs);
    }
    subs.add(socketId);
  }

  public broadcastProgress(jobId: string, progressPercent: number, stage: string): ProgressBroadcast {
    const subs = this.roomSubscriptions.get(jobId);
    const count = subs ? subs.size : 0;
    this.logger.log(`Broadcasting job ${jobId} progress ${progressPercent}% to ${count} clients`);
    return { jobId, progressPercent, stage, subscribersNotified: count };
  }
}
