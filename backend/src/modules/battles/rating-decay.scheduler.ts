import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class RatingDecayScheduler implements OnModuleInit {
  constructor(@InjectQueue('rating-decay') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'weekly-rating-decay',
      { pattern: '0 0 0 * * 1', tz: 'UTC' },
      {
        name: 'weekly-rating-decay',
        data: {},
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      },
    );
    await this.queue.upsertJobScheduler(
      'rating-decay-warning',
      { pattern: '0 0 0 * * 6', tz: 'UTC' },
      {
        name: 'rating-decay-warning',
        data: {},
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      },
    );
  }
}
