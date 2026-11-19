import { describe, it, expect } from "vitest";

function evaluateSmurfRisk(input: {
  timeToFirstSubmitSec: number;
  typingSpeedWpm: number;
  cyclomaticEfficiency: number;
  firstAttemptPassRate: number;
  optimalComplexity: boolean;
}) {
  const speedScore = Math.max(0, Math.min(1, (260 - input.timeToFirstSubmitSec) / 230));
  const wpmScore = Math.max(0, Math.min(1, (input.typingSpeedWpm - 35) / 85));
  const z =
    -5.45 +
    2.15 * speedScore +
    1.85 * wpmScore +
    1.95 * input.cyclomaticEfficiency +
    2.35 * input.firstAttemptPassRate +
    2.1 * (input.optimalComplexity ? 0.95 : 0.3);
  const prob = 1 / (1 + Math.exp(-z));
  return {
    probability: Number(prob.toFixed(4)),
    fastMmrMultiplier: prob > 0.85 ? 3 : 1,
  };
}

describe("Anti-Smurf Placement Classifier Thresholds", () => {
  it("triggers 3x Fast MMR Placement when probability exceeds 0.85", () => {
    const smurf = evaluateSmurfRisk({
      timeToFirstSubmitSec: 30,
      typingSpeedWpm: 122,
      cyclomaticEfficiency: 0.95,
      firstAttemptPassRate: 1.0,
      optimalComplexity: true,
    });
    expect(smurf.probability).toBeGreaterThan(0.85);
    expect(smurf.fastMmrMultiplier).toBe(3);

    const beginner = evaluateSmurfRisk({
      timeToFirstSubmitSec: 230,
      typingSpeedWpm: 40,
      cyclomaticEfficiency: 0.55,
      firstAttemptPassRate: 0.4,
      optimalComplexity: false,
    });
    expect(beginner.probability).toBeLessThanOrEqual(0.85);
    expect(beginner.fastMmrMultiplier).toBe(1);
  });
});
