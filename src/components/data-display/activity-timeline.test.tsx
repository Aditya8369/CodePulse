import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivityTimeline } from "./activity-timeline";
import type { Activity } from "@/types";

const today = new Date().toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const activities: Activity[] = [
  { id: "battle", type: "battle", title: "Won a battle", description: "Against Alex", createdAt: today },
  { id: "challenge", type: "challenge", title: "Finished daily challenge", description: "Three commits", createdAt: today },
  { id: "achievement", type: "achievement", title: "Unlocked badge", description: "First win", createdAt: yesterday },
  { id: "commit", type: "commit", title: "Pushed commits", description: "Refactored auth module", repository: "codepulse", createdAt: yesterday },
  { id: "pr", type: "pull_request", title: "Opened PR", description: "Improved timeline", repository: "another-repo", createdAt: yesterday },
  { id: "issue", type: "issue", title: "Opened issue", description: "Fix search", createdAt: yesterday },
];

describe("ActivityTimeline", () => {
  it("filters battle, challenge, and GitHub events while exposing pressed state", async () => {
    render(<ActivityTimeline activities={activities} />);

    fireEvent.click(screen.getByRole("button", { name: /Battles/ }));
    expect(screen.getByText("Won a battle")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("Finished daily challenge")).toBeNull());
    expect(screen.getByRole("button", { name: /Battles/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /Challenges/ }));
    expect(screen.getByText("Finished daily challenge")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("Won a battle")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /GitHub Commits & PRs/ }));
    expect(screen.getByText("Pushed commits")).toBeDefined();
    expect(screen.getByText("Opened PR")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("Opened issue")).toBeNull());
  });

  it("searches repository and description and shows an empty state", async () => {
    render(<ActivityTimeline activities={activities} />);
    const search = screen.getByRole("searchbox", { name: "Search activities" });

    fireEvent.change(search, { target: { value: "CODEPULSE" } });
    expect(screen.getByText("Pushed commits")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("Opened PR")).toBeNull());

    fireEvent.change(search, { target: { value: "improved timeline" } });
    expect(screen.getByText("Opened PR")).toBeDefined();
    await waitFor(() => expect(screen.queryByText("Pushed commits")).toBeNull());

    fireEvent.change(search, { target: { value: "no matches" } });
    expect(screen.getByText("No matching activities found")).toBeDefined();
  });

  it("groups dates and loads more ten at a time, resetting on filter change", async () => {
    const many = Array.from({ length: 12 }, (_, index): Activity => ({
      id: `commit-${index}`,
      type: "commit",
      title: `Commit ${index}`,
      description: "Commit description",
      createdAt: index < 6 ? today : yesterday,
    }));
    render(<ActivityTimeline activities={many} maxItems={10} />);

    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("Yesterday")).toBeDefined();
    expect(screen.queryByText("Commit 11")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Load More/ }));
    expect(screen.getByText("Commit 11")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Load More/ })).toBeNull();

    fireEvent.click(screen.getByText("Commits").closest("button")!);
    await waitFor(() => expect(screen.queryByText("Commit 11")).toBeNull());
    expect(screen.getByRole("button", { name: /Load More/ })).toBeDefined();
  });
});
