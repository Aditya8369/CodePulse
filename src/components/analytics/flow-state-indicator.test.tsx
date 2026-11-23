import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FlowStateIndicator } from "./flow-state-indicator";

describe("FlowStateIndicator (Non-Intrusive Gentle Wellness Nudge & Telemetry)", () => {
  it("displays Flow Score, Fatigue Index, and dismissible 90-minute gentle breather nudge", () => {
    render(
      <FlowStateIndicator
        flowScore={86}
        cognitiveFatigueIndex={42}
        activeFlowMinutes={90}
        actionableTip="Step away for a short walk and hydrate."
      />
    );

    expect(screen.getByTestId("flow-score-pill").textContent).toContain("Flow: 86/100");
    expect(screen.getByTestId("fatigue-index-pill").textContent).toContain("Fatigue: 42/100");
    expect(screen.getByTestId("gentle-wellness-nudge").textContent).toContain(
      "You have been in intense flow for 90 minutes. Take a 5-minute breather!"
    );

    fireEvent.click(screen.getByLabelText("Dismiss wellness nudge"));
    expect(screen.queryByTestId("gentle-wellness-nudge")).toBeNull();
  });
});
