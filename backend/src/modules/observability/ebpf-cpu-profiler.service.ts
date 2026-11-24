export interface ProfileSample {
  stackTrace: string[];
  sampleCount: number;
}

export class EbpfCPUProfilerService {
  private samples: ProfileSample[] = [];

  public recordSample(stackTrace: string[]): void {
    const key = stackTrace.join(';');
    const existing = this.samples.find(s => s.stackTrace.join(';') === key);
    if (existing) {
      existing.sampleCount++;
    } else {
      this.samples.push({ stackTrace, sampleCount: 1 });
    }
  }

  public generateFlameGraphSummary(): { stack: string; value: number }[] {
    return this.samples.map(s => ({
      stack: s.stackTrace.join(';'),
      value: s.sampleCount
    }));
  }
}
