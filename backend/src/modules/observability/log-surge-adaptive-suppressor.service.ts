import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LogSurgeAdaptiveSuppressorService {
  private readonly logger = new Logger(LogSurgeAdaptiveSuppressorService.name);
  private recentLogRate = 100; // lines/sec

  public evaluateLogSampling(currentLogsPerSec: number): { sampleRate: number; suppressed: boolean } {
    if (currentLogsPerSec > 5000) {
      this.logger.warn(`Severe log volume surge (${currentLogsPerSec} lines/s)! Suppressing to 1% sampling.`);
      return { sampleRate: 0.01, suppressed: true };
    }
    if (currentLogsPerSec > 1000) {
      return { sampleRate: 0.1, suppressed: true };
    }
    return { sampleRate: 1.0, suppressed: false };
  }
}
