import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { SpectatorReactionStorm } from "./spectator-reaction-storm";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SpectatorReactionStorm", () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
    });
  });

  it("renders spectator reaction storm HUD and emoji hotbar correctly", () => {
    render(<SpectatorReactionStorm initialHypeScore={200} />);

    expect(screen.getByTestId("spectator-reaction-storm-container")).toBeInTheDocument();
    expect(screen.getByTestId("spectator-physics-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("storm-status-badge")).toHaveTextContent(/SPECTATOR STORM/i);
    expect(screen.getByTestId("total-hype-score")).toHaveTextContent("200 pts");
    expect(screen.getByTestId("emoji-btn-1")).toBeInTheDocument(); // Fire
    expect(screen.getByTestId("emoji-btn-2")).toBeInTheDocument(); // Thunder
  });

  it("triggers reaction on emoji button click and increments combo", () => {
    const onSendReactionMock = vi.fn();
    render(<SpectatorReactionStorm onSendReaction={onSendReactionMock} initialHypeScore={100} />);

    const fireBtn = screen.getByTestId("emoji-btn-1");
    fireEvent.click(fireBtn);

    expect(onSendReactionMock).toHaveBeenCalledWith("🔥", 1);
    expect(screen.getByTestId("combo-multiplier-badge")).toBeInTheDocument();
    expect(screen.getByTestId("combo-multiplier-badge")).toHaveTextContent(/1x COMBO/i);
  });

  it("handles keyboard shortcuts (1-6) to trigger reactions", () => {
    const onSendReactionMock = vi.fn();
    render(<SpectatorReactionStorm onSendReaction={onSendReactionMock} />);

    fireEvent.keyDown(window, { key: "3" }); // Rocket emoji

    expect(onSendReactionMock).toHaveBeenCalledWith("🚀", 1);
  });

  it("toggles audio feedback button", () => {
    render(<SpectatorReactionStorm />);

    const soundBtn = screen.getByTestId("toggle-sound-btn");
    expect(soundBtn).toHaveAttribute("aria-label", "Enable audio reactions");

    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveAttribute("aria-label", "Mute audio reactions");
  });
});
