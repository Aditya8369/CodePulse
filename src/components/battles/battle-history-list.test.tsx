import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BattleHistoryList, type HistoricalBattle } from "./battle-history-list";

describe("BattleHistoryList illustrated empty state", () => {
  it("renders SVG illustrated empty state when battles list is empty", () => {
    const onStartNew = vi.fn();
    render(<BattleHistoryList battles={[]} onReplay={vi.fn()} onStartNew={onStartNew} />);

    expect(screen.getByTestId("battle-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("battle-empty-illustration")).toBeInTheDocument();
    expect(screen.getByText("No Battle History Yet")).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: /start your first battle/i });
    expect(startBtn).toBeInTheDocument();

    fireEvent.click(startBtn);
    expect(onStartNew).toHaveBeenCalledTimes(1);
  });

  it("renders battle items when battles exist", () => {
    const mockBattle: HistoricalBattle = {
      id: "b-1",
      player1: { username: "octocat" },
      player2: { username: "torvalds" },
      battleType: "Full Stack Duel",
      winner: "p1",
      p1Score: 85,
      p2Score: 70,
      xpChange: 150,
      createdAt: new Date().toISOString(),
    };

    render(<BattleHistoryList battles={[mockBattle]} onReplay={vi.fn()} />);

    expect(screen.getByText("VICTORY")).toBeInTheDocument();
    expect(screen.queryByTestId("battle-empty-illustration")).not.toBeInTheDocument();
  });
});
