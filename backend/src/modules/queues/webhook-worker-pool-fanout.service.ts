import { Injectable, Logger } from '@nestjs/common';

export interface FanoutBatch {
  workerId: number;
  targets: string[];
}

@Injectable()
export class WebhookWorkerPoolFanoutService {
  private readonly logger = new Logger(WebhookWorkerPoolFanoutService.name);
  private readonly poolSize = 4;

  public partitionFanout(urls: string[]): FanoutBatch[] {
    const batches: FanoutBatch[] = Array.from({ length: this.poolSize }, (_, i) => ({
      workerId: i,
      targets: [],
    }));

    urls.forEach((url, idx) => {
      batches[idx % this.poolSize].targets.push(url);
    });

    return batches.filter(b => b.targets.length > 0);
  }
}
