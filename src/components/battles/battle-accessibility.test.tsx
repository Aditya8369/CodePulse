import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BattleSetup } from "./battle-setup";
import { BattleReport } from "./battle-report";

vi.mock("@/lib/celebration", () => ({
  triggerDualCannonConfetti: vi.fn(),
  playVictorySound: vi.fn(),
}));

describe("Battle Arena keyboard and screen reader flow", () => {
  it("names the setup inputs and exposes the selected battle type to keyboard users", () => {
    const onStart = vi.fn();
    render(<BattleSetup onStart={onStart} focusFirstInput />);

    const challenger = screen.getByRole("textbox", { name: "Challenger" });
    const opponent = screen.getByRole("textbox", { name: "Opponent" });
    expect(document.activeElement).toBe(challenger);

    const typeToggle = screen.getByRole("button", { name: "Battle type: Overall Battle" });
    expect(typeToggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(typeToggle);
    expect(typeToggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Activity Battle" }));
    expect(screen.getByRole("button", { name: "Battle type: Activity Battle" }).getAttribute("aria-expanded")).toBe("false");

    fireEvent.change(challenger, { target: { value: "alice" } });
    fireEvent.change(opponent, { target: { value: "bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Start battle between developers" }));
    expect(onStart).toHaveBeenCalledWith("alice", "bob", "Activity Battle");
  });

  it("focuses and announces the completed result before rematch", () => {
    const onRematch = vi.fn();
    const player1 = { username: "alice", name: "Alice", avatar: "https://example.com/alice.png", score: 0, stats: { totalCommits: 20 }, topLanguages: [] };
    const player2 = { username: "bob", name: "Bob", avatar: "https://example.com/bob.png", score: 0, stats: { totalCommits: 10 }, topLanguages: [] };
    render(<BattleReport player1={player1} player2={player2} battleType="Overall Battle" onRematch={onRematch} />);

    const heading = screen.getByRole("heading", { name: /Battle Completed/ });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("status").textContent).toContain("Alice won against Bob, 20 to 10");
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    expect(onRematch).toHaveBeenCalledOnce();
  });
});
