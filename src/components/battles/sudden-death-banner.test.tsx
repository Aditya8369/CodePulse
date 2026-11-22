import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { SuddenDeathBanner } from "./sudden-death-banner";

describe("SuddenDeathBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("renders sudden death tiebreaker banner with countdown timer", () => {
    render(
      <SuddenDeathBanner
        durationSeconds={120}
        puzzleTitle="Rapid-Fire Bugfix: Inverted Binary Tree Depth"
      />
    );

    expect(screen.getByTestId("sudden-death-banner-container")).toBeInTheDocument();
    expect(screen.getByTestId("sudden-death-status-badge")).toHaveTextContent(/SUDDEN DEATH TIEBREAKER/i);
    expect(screen.getByText("Rapid-Fire Bugfix: Inverted Binary Tree Depth")).toBeInTheDocument();
    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("02:00");
    expect(screen.getByTestId("open-micro-puzzle-btn")).toBeInTheDocument();
  });

  it("updates countdown as time advances", () => {
    render(<SuddenDeathBanner durationSeconds={60} />);

    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("01:00");

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByTestId("countdown-digits")).toHaveTextContent("00:45");
  });

  it("switches to critical sudden death state when remaining time <= 30s", () => {
    render(<SuddenDeathBanner durationSeconds={25} />);

    expect(screen.getByTestId("sudden-death-status-badge")).toHaveTextContent(/CRITICAL SUDDEN DEATH/i);
  });

  it("triggers onOpenEditor when clicking Open Puzzle button", () => {
    const onOpenEditorMock = vi.fn();
    render(<SuddenDeathBanner onOpenEditor={onOpenEditorMock} />);

    const openBtn = screen.getByTestId("open-micro-puzzle-btn");
    fireEvent.click(openBtn);

    expect(onOpenEditorMock).toHaveBeenCalledTimes(1);
  });

  it("fires onTimeExpired when countdown reaches zero", () => {
    const onTimeExpiredMock = vi.fn();
    render(<SuddenDeathBanner durationSeconds={5} onTimeExpired={onTimeExpiredMock} />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onTimeExpiredMock).toHaveBeenCalled();
  });
});
