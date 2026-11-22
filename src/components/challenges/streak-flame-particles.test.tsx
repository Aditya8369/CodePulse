import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { StreakFlameParticles } from "./streak-flame-particles";

describe("StreakFlameParticles Component", () => {
  it("does not render when streak is below 7 days", () => {
    const { container } = render(<StreakFlameParticles streak={5} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders burning particles and milestone badge when streak is 7+ days", () => {
    render(<StreakFlameParticles streak={7} />);
    expect(screen.getByTestId("streak-flame-particles-container")).toBeInTheDocument();
    expect(screen.getByText("7+ Days Streak On Fire!")).toBeInTheDocument();
    const particles = screen.getAllByTestId("streak-ember-particle");
    expect(particles.length).toBeGreaterThan(0);
  });

  it("renders without badge when showBadge is false", () => {
    render(<StreakFlameParticles streak={14} showBadge={false} />);
    expect(screen.getByTestId("streak-flame-particles-container")).toBeInTheDocument();
    expect(screen.queryByText("7+ Days Streak On Fire!")).toBeNull();
  });
});
