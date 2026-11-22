import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BattleIntro } from "./battle-intro";

describe("BattleIntro", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances through loading steps and clamps countdown timer >= 0", () => {
    const onIntroComplete = vi.fn();
    render(
      <BattleIntro
        p1Username="octocat"
        p2Username="defunkt"
        onIntroComplete={onIntroComplete}
        initialCountdown={2}
      />
    );

    // Initial step
    expect(screen.getByText("Loading GitHub Data...")).toBeInTheDocument();

    // Advance 4 steps (800ms each = 3200ms)
    act(() => {
      vi.advanceTimersByTime(3200);
    });

    // Battle Begins step is shown with countdown
    expect(screen.getByText("⚔️ Battle Begins")).toBeInTheDocument();
    const countdown = screen.getByTestId("arena-countdown-timer");
    expect(countdown).toBeInTheDocument();

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(countdown.textContent).toMatch(/^[0-9]+s$/);

    // Advance past total duration
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Ensure onIntroComplete called and countdown never went negative
    expect(onIntroComplete).toHaveBeenCalledTimes(1);
    expect(countdown.textContent).not.toContain("-");
  });
});
