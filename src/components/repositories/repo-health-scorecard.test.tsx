import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepoHealthScorecard } from "./repo-health-scorecard";

describe("RepoHealthScorecard", () => {
  it("renders the grade, checklist, and specific improvements", () => {
    render(<RepoHealthScorecard inspection={{
      license: "MIT",
      health: {
        hasLicense: true, hasReadme: true, hasContributing: false, hasCi: false,
        openIssues: 4, closedIssues: 1, lastCommitAt: "",
      },
    }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByText("Grade: F (40/100)")).toBeInTheDocument();
    expect(screen.getByText("GitHub Actions CI: Missing")).toBeInTheDocument();
    expect(screen.getByText(/Add a GitHub Actions workflow/)).toBeInTheDocument();
  });
});
