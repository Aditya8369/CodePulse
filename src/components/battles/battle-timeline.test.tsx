import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BattleTimeline } from "./battle-timeline";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

  it("renders playback speed controller dock with 0.5x, 1x, 2x, 4x, 8x buttons and handles speed switch", () => {
    const player1 = baseDev("alice", "Alice", {});
    const player2 = baseDev("bob", "Bob", {});
    const onSpeedChange = vi.fn();

    render(
      <BattleTimeline
        player1={player1}
        player2={player2}
        battleType="Overall Battle"
        onSpeedChange={onSpeedChange}
      />
    );

    expect(screen.getByTestId("playback-speed-controller-dock")).toBeInTheDocument();
    expect(screen.getByTestId("speed-btn-0.5x")).toBeInTheDocument();
    expect(screen.getByTestId("speed-btn-1x")).toBeInTheDocument();
    expect(screen.getByTestId("speed-btn-2x")).toBeInTheDocument();
    expect(screen.getByTestId("speed-btn-4x")).toBeInTheDocument();
    expect(screen.getByTestId("speed-btn-8x")).toBeInTheDocument();

    // Select 4x speed
    fireEvent.click(screen.getByTestId("speed-btn-4x"));
    expect(onSpeedChange).toHaveBeenCalledWith(4);
    expect(screen.getByTestId("speed-btn-4x")).toHaveAttribute("aria-pressed", "true");

    // Play/Pause button toggle
    const playPauseBtn = screen.getByTestId("replay-play-pause-btn");
    fireEvent.click(playPauseBtn);
    expect(screen.getByText(/Replay Streaming/i)).toBeInTheDocument();
  });
});
