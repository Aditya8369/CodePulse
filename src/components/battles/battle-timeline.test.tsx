import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BattleTimeline } from "./battle-timeline";

const baseDev = (username: string, name: string, stats: Record<string, unknown> = {}) => ({
  username,
  name,
  avatar: `https://example.com/${username}.png`,
  score: 100,
  stats,
  topLanguages: [],
});

describe("BattleTimeline", () => {
  it("renders round-by-round breakdown with speed delta and chart", () => {
    const player1 = baseDev("alice", "Alice", {
      totalCommits: 500,
      totalPRs: 50,
      totalStars: 1200,
      followers: 3000,
      streak: 10,
      repos: 40,
    });
    const player2 = baseDev("bob", "Bob", {
      totalCommits: 300,
      totalPRs: 30,
      totalStars: 800,
      followers: 1500,
      streak: 5,
      repos: 25,
    });

    render(
      <BattleTimeline player1={player1} player2={player2} battleType="Overall Battle" />
    );

    expect(screen.getByText(/Round-by-Round Breakdown/)).toBeDefined();
    expect(screen.getByText(/Speed Delta/)).toBeDefined();
    expect(screen.getByText(/Cumulative Score Progression/)).toBeDefined();
    expect(screen.getByText(/Timeline Total/)).toBeDefined();
    // 5 rounds rendered as accordion items
    expect(screen.getByText(/Profile Battle/)).toBeDefined();
    expect(screen.getByText(/Activity Battle/)).toBeDefined();
  });

  it("filters rounds based on battle type", () => {
    const player1 = baseDev("alice", "Alice", {});
    const player2 = baseDev("bob", "Bob", {});

    render(
      <BattleTimeline player1={player1} player2={player2} battleType="Language Battle" />
    );

    expect(screen.getByText(/Language Battle/)).toBeDefined();
    expect(screen.queryByText(/Profile Battle/)).not.toBeInTheDocument();
  });
});
