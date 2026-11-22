import { describe, expect, it } from "vitest";
import { buildStreakMonth, getActivityDays, longestActivityStreak } from "./streak-calendar";

describe("buildStreakMonth", () => {
  it("starts weeks on Monday and has the correct February leap-day count", () => {
    const cells = buildStreakMonth(2024, 1, []);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect(cells[3]?.date).toBe("2024-02-01");
    expect(cells.at(-1)?.date).toBe("2024-02-29");
  });

  it("prioritizes actual activity over a protected-day marker", () => {
    const cells = buildStreakMonth(2026, 10, [{ date: "2026-11-03", count: 2 }], ["2026-11-02", "2026-11-03"]);
    expect(cells.find((cell) => cell?.date === "2026-11-02")?.status).toBe("protected");
    expect(cells.find((cell) => cell?.date === "2026-11-03")?.status).toBe("active");
    expect(cells.find((cell) => cell?.date === "2026-11-04")?.status).toBe("inactive");
  });
});

describe("longestActivityStreak", () => {
  it("counts consecutive dates across month boundaries", () => {
    expect(longestActivityStreak([
      { date: "2026-01-30", count: 1 },
      { date: "2026-01-31", count: 3 },
      { date: "2026-02-01", count: 1 },
      { date: "2026-02-03", count: 1 },
    ])).toBe(3);
  });
});

describe("getActivityDays", () => {
  it("accepts synced dates and ignores malformed JSON rows", () => {
    expect(getActivityDays([
      null,
      { date: "2026-02-30", count: 3 },
      { date: "2026-99-01", count: 3 },
      { date: "2026-02-28", count: "3" },
      { date: "2026-02-27", count: -1 },
      { date: "2024-02-29", count: 2 },
    ])).toEqual([{ date: "2024-02-29", count: 2 }]);
    expect(getActivityDays(null)).toEqual([]);
  });
});
