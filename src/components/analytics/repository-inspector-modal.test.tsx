import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositoryInspectorModal } from "./repository-inspector-modal";

describe("RepositoryInspectorModal badge contrast", () => {
  const mockInspection = {
    fullName: "code-with-dipak-777/CodePulse",
    url: "https://github.com/code-with-dipak-777/CodePulse",
    isPrivate: false,
    license: "MIT",
    stars: 120,
    forks: 35,
    openPullRequests: 4,
    languages: [{ language: "TypeScript", bytes: 100000, percentage: 100, color: "#3178c6" }],
    punchcard: null,
    health: {
      hasReadme: true,
      hasLicense: true,
      hasContributing: true,
      hasCi: true,
      openIssues: 5,
      closedIssues: 15,
      lastCommitAt: "2026-11-20T12:00:00Z",
    },
    branches: ["main", "feature/dashboard"],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockInspection,
      })
    );
  });

  it("renders high-contrast badge classes for public repository and license", async () => {
    render(
      <RepositoryInspectorModal
        fullName="code-with-dipak-777/CodePulse"
        open={true}
        onClose={vi.fn()}
      />
    );

    const publicBadge = await screen.findByTestId("visibility-badge");
    expect(publicBadge).toHaveTextContent("Public");
    expect(publicBadge.className).toContain("text-emerald-300");
    expect(publicBadge.className).toContain("border-emerald-500/40");

    const licenseBadge = await screen.findByTestId("license-badge");
    expect(licenseBadge).toHaveTextContent("MIT");
    expect(licenseBadge.className).toContain("text-indigo-200");
  });
});
