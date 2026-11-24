export interface RumBeacon {
  sessionId: string;
  url: string;
  browser: string;
  country: string;
  connectionType: '4g' | '5g' | 'wifi' | 'slow-2g';
  lcp: number; // Largest Contentful Paint (ms)
  fid: number; // First Input Delay (ms)
  cls: number; // Cumulative Layout Shift
  inp: number; // Interaction to Next Paint (ms)
  ttfb: number; // Time to First Byte (ms)
}

export interface VitalsQuantiles {
  count: number;
  p50: number;
  p75: number;
  p95: number;
  p99: number;
}

export class RumBeaconIngestionService {
  private beacons: RumBeacon[] = [];

  public ingest(beacon: RumBeacon | RumBeacon[]): void {
    if (Array.isArray(beacon)) {
      this.beacons.push(...beacon);
    } else {
      this.beacons.push(beacon);
    }
  }

  public calculateQuantiles(metric: 'lcp' | 'fid' | 'cls' | 'inp' | 'ttfb'): VitalsQuantiles {
    if (this.beacons.length === 0) {
      return { count: 0, p50: 0, p75: 0, p95: 0, p99: 0 };
    }

    const values = this.beacons.map(b => b[metric]).sort((a, b) => a - b);
    return {
      count: values.length,
      p50: this.percentile(values, 0.50),
      p75: this.percentile(values, 0.75),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  public detectPerformanceDegradations(): { hasDegradation: boolean; reasons: string[] } {
    const lcp75 = this.calculateQuantiles('lcp').p75;
    const cls75 = this.calculateQuantiles('cls').p75;
    const inp75 = this.calculateQuantiles('inp').p75;

    const reasons: string[] = [];
    if (lcp75 > 2500) reasons.push(`LCP p75 is ${lcp75}ms (budget: <= 2500ms)`);
    if (cls75 > 0.1) reasons.push(`CLS p75 is ${cls75} (budget: <= 0.1)`);
    if (inp75 > 200) reasons.push(`INP p75 is ${inp75}ms (budget: <= 200ms)`);

    return {
      hasDegradation: reasons.length > 0,
      reasons
    };
  }
}
