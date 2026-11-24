import { Injectable } from '@nestjs/common';

export type WaitStrategy = 'SPIN' | 'YIELD' | 'SLEEP';

@Injectable()
export class RingBufferWaitRegulatorService {
  public selectWaitStrategy(spinsCount: number): WaitStrategy {
    if (spinsCount < 100) return 'SPIN'; // Low spin under microsecond delays
    if (spinsCount < 1000) return 'YIELD'; // Yield thread slice to prevent CPU saturation
    return 'SLEEP'; // Block on condition variable / timer
  }
}
