import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { calculateLanguageOverlap, HeadToHeadCard } from "./head-to-head-card";

const alice = {
  username: "Alice",
  topLanguages: [
    { name: "TypeScript", count: 4 },
    { name: "Python", count: 2 },
  ],
};
const bob = {
  username: "Bob",
  topLanguages: [
    { name: "typescript", count: 3 },
    { name: "Go", count: 1 },
  ],
};

describe("HeadToHeadCard with Interactive Win-Rate Bar", () => {
  it("calculates case-insensitive language overlap without double-counting", () => {
    expect(calculateLanguageOverlap(alice.topLanguages, bob.topLanguages)).toEqual({
      shared: ["TypeScript"],
      percentage: 33,
    });
    expect(calculateLanguageOverlap([], []).percentage).toBeNull();
    expect(calculateLanguageOverlap([{ name: " ", count: 1 }], []).percentage).toBeNull();
  });

  it("renders match tally, latest result, and shared languages", () => {
    render(
      <HeadToHeadCard
        first={alice}
        second={bob}
        isLoading={false}
        hasError={false}
        history={{
          user1Wins: 4,
          user2Wins: 2,
          draws: 0,
          totalMatches: 6,
          latest: {
            date: "2026-11-15T10:00:00Z",
            category: "Commit Sprint",
            user1Score: 7,
            user2Score: 4,
            winner: "Alice",
          },
        }}
      />
    );

    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Latest: 7–4")).toBeDefined();
    expect(screen.getByText("33%")).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.getByTestId("win-rate-bar-container")).toBeInTheDocument();
    expect(screen.getByTestId("win-advantage-badge")).toHaveTextContent("Leader: @Alice");
  });

  it("distinguishes unavailable history from no matches", () => {
    const view = render(<HeadToHeadCard first={alice} second={bob} isLoading={false} hasError={true} />);
    expect(screen.getByText("Battle history is temporarily unavailable.")).toBeDefined();
    view.rerender(<HeadToHeadCard first={alice} second={bob} isLoading={false} hasError={false} />);
    expect(screen.getByText("No direct matches recorded yet.")).toBeDefined();
  });
});
