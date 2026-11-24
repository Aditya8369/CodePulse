export interface HeapSample {
  timestamp: number;
  usedBytes: number;
}

export class V8HeapLeakDetectorService {
  private samples: HeapSample[] = [];

  public recordSample(usedBytes: number, timestamp: number = Date.now()): void {
    this.samples.push({ timestamp, usedBytes });
    if (this.samples.length > 20) {
      this.samples.shift();
    }
  }

  public detectSustainedGrowthSlope(minSamples: number = 5): { isLeaking: boolean; growthSlopeBytesPerSec: number } {
    if (this.samples.length < minSamples) {
      return { isLeaking: false, growthSlopeBytesPerSec: 0 };
    }

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const timeDeltaSec = (last.timestamp - first.timestamp) / 1000;

    if (timeDeltaSec <= 0) return { isLeaking: false, growthSlopeBytesPerSec: 0 };

    const growthSlopeBytesPerSec = (last.usedBytes - first.usedBytes) / timeDeltaSec;

    // Check if strictly monotonically increasing
    let isMonotonic = true;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].usedBytes < this.samples[i - 1].usedBytes) {
        isMonotonic = false;
        break;
      }
    }

    const isLeaking = isMonotonic && growthSlopeBytesPerSec > 1024 * 1024; // > 1MB/sec sustained

    return { isLeaking, growthSlopeBytesPerSec };
  }
}
