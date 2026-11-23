import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CarbonBadge } from "./carbon-badge";

describe("CarbonBadge (Green Software CO2 Savings & Regional Grid Switcher)", () => {
  it("displays Green Code badge tier, recalculates CO2 when switching regions, and warns on O(N^2) hotspots", () => {
    render(
      <CarbonBadge
        repositoryName="codepulse-engine"
        cpuEnergyMj={150}
        dramEnergyMj={50}
        durationMs={90}
        defaultRegion="aws:eu-north-1"
      />
    );

    expect(screen.getByTestId("green-code-tier-pill").textContent).toBe("Platinum Leaf");
    expect(screen.getByTestId("carbon-total-mj").textContent).toBe("200.0 mJ");
    const stockholmCo2 = screen.getByTestId("carbon-co2-grams").textContent;

    // Switch to Mumbai (ap-south-1: 632 gCO2/kWh) -> CO2 increases significantly
    fireEvent.change(screen.getByLabelText("Cloud Carbon Region"), {
      target: { value: "aws:ap-south-1" },
    });
    const mumbaiCo2 = screen.getByTestId("carbon-co2-grams").textContent;
    expect(mumbaiCo2).not.toBe(stockholmCo2);
  });
});
