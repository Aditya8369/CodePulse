import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RatingDecayService } from './rating-decay.service';

@Processor('rating-decay')
export class RatingDecayWorker extends WorkerHost {
  constructor(private readonly decay: RatingDecayService) {
    super();
  }

  process(job: Job): Promise<number> {
    if (job.name === 'weekly-rating-decay') return this.decay.runDecay();
    if (job.name === 'rating-decay-warning') return this.decay.sendWarnings();
    throw new Error(`Unknown rating decay job: ${job.name}`);
  }
}
