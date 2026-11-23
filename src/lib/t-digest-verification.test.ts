import { describe, it, expect } from "vitest";
import { StreamingTDigest } from "../../backend/src/common/math/t-digest.service";

describe("StreamingTDigest Mathematical Accuracy (Vitest Suite)", () => {
  it("achieves < 0.1% relative error at P95 and P99 while keeping centroid memory under 50KB", () => {
    const N = 200_000;
    const digest = new StreamingTDigest(250);
    const exact = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      const val = (i + 1) * 0.5;
      digest.add(val);
      exact[i] = val;
    }

    exact.sort();
    const exactP95 = exact[Math.floor(N * 0.95)];
    const exactP99 = exact[Math.floor(N * 0.99)];

    const estP95 = digest.percentile(95);
    const estP99 = digest.percentile(99);

    expect(Math.abs(estP95 - exactP95) / exactP95).toBeLessThan(0.001);
    expect(Math.abs(estP99 - exactP99) / exactP99).toBeLessThan(0.001);
    expect(digest.getMemoryBytes()).toBeLessThan(50 * 1024);
  });
});
