import { describe, expect, it } from "vitest";
import { scoreRepositoryHealth, type RepositoryHealth } from "./repository-health";

const complete: RepositoryHealth = {
  hasReadme: true, hasLicense: true, hasContributing: true, hasCi: true,
  openIssues: 2, closedIssues: 8, lastCommitAt: "2026-11-01T00:00:00Z",
};
const now = Date.parse("2026-11-17T00:00:00Z");

describe("repository health score", () => {
  it("awards five equally weighted categories and an A+ grade", () => {
    expect(scoreRepositoryHealth(complete, "MIT", now)).toMatchObject({ score: 100, grade: "A+", available: 100, provisional: false });
  });

  it("weights documentation separately and grades partial failures", () => {
    const result = scoreRepositoryHealth({ ...complete, hasReadme: false, hasCi: false, openIssues: 8, closedIssues: 2 }, "MIT", now);
    expect(result.categories.map(({ points }) => points)).toEqual([20, 10, 0, 10, 20]);
    expect(result).toMatchObject({ score: 60, grade: "D" });
  });

  it("does not count unavailable GitHub data as a failed check", () => {
    const result = scoreRepositoryHealth({ ...complete, hasCi: null, hasContributing: null, openIssues: null, closedIssues: null, lastCommitAt: null }, "MIT", now);
    expect(result).toMatchObject({ score: 100, available: 30, provisional: true });
    expect(result.categories[2].points).toBeNull();
  });

  it("treats no recent commits as inactive without inventing activity", () => {
    expect(scoreRepositoryHealth({ ...complete, lastCommitAt: "" }, "MIT", now).categories[4].points).toBe(0);
    expect(scoreRepositoryHealth({ ...complete, lastCommitAt: "2026-09-01T00:00:00Z" }, "MIT", now).categories[4].points).toBe(10);
  });
});
