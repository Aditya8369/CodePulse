import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RepositoryBubbleChart } from "./repository-bubble-chart";
import type { Repository } from "@/types";

afterEach(() => vi.unstubAllGlobals());

describe("repository inspector entry point", () => {
  it("opens GitHub-backed details when a repository card is selected", async () => {
    const fetchDetails = vi.fn().mockResolvedValue(Response.json({
      fullName: "owner/project", url: "https://github.com/owner/project", isPrivate: false,
      license: "MIT", stars: 12, forks: 3, openPullRequests: 1,
      languages: [{ language: "TypeScript", bytes: 75, percentage: 75, color: "#3178c6" },
        { language: "CSS", bytes: 25, percentage: 25, color: "#563d7c" }],
      punchcard: [[0, 0, 2]],
      health: { hasReadme: true, hasLicense: true, openIssues: 2, closedIssues: 8 },
      branches: ["main"],
    }));
    vi.stubGlobal("fetch", fetchDetails);
    const repo = {
      id: "1", name: "project", fullName: "owner/project", url: "https://github.com/owner/project",
      stars: 12, forks: 3, language: "TypeScript", languageColor: "#3178c6",
    } as Repository;

    render(<RepositoryBubbleChart repos={[repo]} owner="owner" />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect repository owner/project" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Issues open:closed")).toBeTruthy());
    expect(fetchDetails).toHaveBeenCalledWith(
      "/api/github/repository-inspector?repo=owner%2Fproject",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.click(screen.getByRole("tab", { name: /languages/i }));
    expect(screen.getByText(/75\.0%/)).toBeTruthy();
  });
});
