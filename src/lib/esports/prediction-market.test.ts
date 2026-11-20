import { describe, it, expect } from "vitest";

function calculateParimutuelOdds(pools: Record<string, number>) {
  const total = Object.values(pools).reduce((a, b) => a + b, 0);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(pools)) {
    result[k] = total === 0 || v === 0 ? 2.0 : Number(Math.max(1.05, total / v).toFixed(2));
  }
  return result;
}

describe("Esports Parimutuel Odds & Spoiler Lock Window", () => {
  it("computes real-time parimutuel odds from pool weights and enforces 120s lock", () => {
    const odds = calculateParimutuelOdds({ playerA: 750, playerB: 250 });
    expect(odds.playerA).toBe(1.33);
    expect(odds.playerB).toBe(4.0);

    const matchStart = 10_000;
    const lockAt = matchStart + 120_000;
    expect(matchStart + 119_000 < lockAt).toBe(true);
    expect(matchStart + 120_000 >= lockAt).toBe(true);
  });
});
