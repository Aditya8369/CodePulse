export class DynamicLogSamplerService {
  public shouldSample(logLevel: 'INFO' | 'WARN' | 'ERROR', logsPerSec: number): boolean {
    if (logLevel === 'ERROR') return true; // Never drop errors

    if (logsPerSec > 1000) {
      return Math.random() < 0.1; // 10% sampling
    } else if (logsPerSec > 500) {
      return Math.random() < 0.5; // 50% sampling
    }

    return true; // 100% logging under normal volume
  }
}
