import crypto from 'node:crypto';

export interface SampledLogResult {
  shouldLog: boolean;
  suppressedCount: number;
  fingerprint: string;
}

export class AdaptiveLogSamplerService {
  private errorFrequencies = new Map<string, { count: number; windowStart: number; suppressed: number }>();

  constructor(
    private readonly windowMs = 5000,
    private readonly maxUnsampledPerWindow = 5,
    private readonly sampleRatio = 10 // 1 in 10 after threshold
  ) {}

  public evaluateLog(errorName: string, message: string, stack?: string): SampledLogResult {
    // Generate signature fingerprint based on error type and first frame
    const topFrame = (stack || '').split('\n')[1]?.trim() || '';
    const fingerprint = crypto.createHash('md5').update(`${errorName}:${message}:${topFrame}`).digest('hex').substring(0, 8);

    const now = Date.now();
    let stats = this.errorFrequencies.get(fingerprint);

    if (!stats || now - stats.windowStart > this.windowMs) {
      stats = { count: 1, windowStart: now, suppressed: 0 };
      this.errorFrequencies.set(fingerprint, stats);
      return { shouldLog: true, suppressedCount: 0, fingerprint };
    }

    stats.count++;

    if (stats.count <= this.maxUnsampledPerWindow) {
      return { shouldLog: true, suppressedCount: 0, fingerprint };
    }

    // Adaptive sampling: only emit 1 in sampleRatio logs
    if (stats.count % this.sampleRatio === 0) {
      const suppressed = stats.suppressed;
      stats.suppressed = 0;
      return { shouldLog: true, suppressedCount: suppressed, fingerprint };
    } else {
      stats.suppressed++;
      return { shouldLog: false, suppressedCount: stats.suppressed, fingerprint };
    }
  }
}
