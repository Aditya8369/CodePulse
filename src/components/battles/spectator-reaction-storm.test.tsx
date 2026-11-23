import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpectatorReactionStorm } from "./spectator-reaction-storm";

describe("SpectatorReactionStorm (#1055)", () => {
  it("renders container, canvas, and diagnostics HUD", () => {
    render(<SpectatorReactionStorm battleId="battle-1055" />);

    expect(screen.getByTestId("reaction-storm-container")).toBeInTheDocument();
    expect(screen.getByTestId("reaction-storm-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("fps-counter")).toBeInTheDocument();
    expect(screen.getByTestId("particle-counter")).toBeInTheDocument();
  });

  it("renders reaction buttons and invokes onEmitReaction when clicked", () => {
    const onEmitReaction = jest.fn();
    render(
      <SpectatorReactionStorm
        battleId="battle-1055"
        onEmitReaction={onEmitReaction}
      />
    );

    const fireButton = screen.getByTestId("react-btn-🔥");
    expect(fireButton).toBeInTheDocument();

    fireEvent.click(fireButton);
    expect(onEmitReaction).toHaveBeenCalledWith("🔥");
  });

  it("triggers storm bursts cleanly without crashing", () => {
    render(<SpectatorReactionStorm battleId="battle-1055" maxParticles={5000} />);

    const megaStormBtn = screen.getByText("5,000 Mega Storm");
    expect(megaStormBtn).toBeInTheDocument();

    expect(() => fireEvent.click(megaStormBtn)).not.toThrow();
  });
});
