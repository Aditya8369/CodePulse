import { Injectable, Logger } from '@nestjs/common';

export interface StackSample {
  frames: string[];
  sampleCount: number;
}

@Injectable()
export class EbpfFlameGraphGeneratorService {
  private readonly logger = new Logger(EbpfFlameGraphGeneratorService.name);

  public collapseStackTraces(samples: StackSample[]): string {
    return samples
      .map((s) => `${s.frames.join(';')} ${s.sampleCount}`)
      .join('\n');
  }
}
