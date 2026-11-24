import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiLeakPredictionProfilerService {
  private readonly logger = new Logger(AiLeakPredictionProfilerService.name);

  public predictLeakProbability(heapDeltas: number[]): { leakProbability: number; warningIssued: boolean } {
    const isMonotonicallyIncreasing = heapDeltas.every((val, i) => i === 0 || val >= heapDeltas[i - 1]);
    const leakProbability = isMonotonicallyIncreasing && heapDeltas.length >= 4 ? 0.92 : 0.15;

    if (leakProbability > 0.8) {
      this.logger.warn(`Memory Leak Probability elevated: ${(leakProbability * 100).toFixed(0)}%`);
    }
    return { leakProbability, warningIssued: leakProbability > 0.8 };
  }
}
