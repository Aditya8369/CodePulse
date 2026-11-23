import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RepositorySunburstMap } from "./repository-sunburst-map";

describe("RepositorySunburstMap (Interactive Subdirectory Drill-Down & Bus Factor Risk)", () => {
  it("renders Sunburst SVG, highlights critical single-owner modules in red, and drills down into subdirectories", () => {
    render(
      <RepositorySunburstMap
        rootNode={{
          directoryPath: ".",
          name: "CodePulse",
          totalDecayedWeight: 500,
          busFactor: 2,
          isCriticalBusFactorRisk: false,
          contributors: [],
          children: [
            {
              directoryPath: "backend/src/crypto",
              name: "crypto",
              totalDecayedWeight: 320,
              busFactor: 1,
              isCriticalBusFactorRisk: true,
              riskReason: "Critical Bus Factor (1): Alice owns 94% and has not committed in 85 days.",
              contributors: [
                {
                  authorId: "u1",
                  authorName: "Alice",
                  ownershipPercent: 94,
                  lastCommitDaysAgo: 85,
                },
              ],
              children: [],
            },
          ],
        }}
      />
    );

    const slice = screen.getByTestId("sunburst-slice-crypto");
    expect(slice.getAttribute("fill")).toBe("#ef4444");

    // Drill down into crypto subdirectory
    fireEvent.click(screen.getByTestId("drill-dir-crypto"));
    expect(screen.getByTestId("bus-factor-risk-alert").textContent).toContain("Alice owns 94%");
    expect(screen.getByTestId("active-bus-factor").textContent).toBe("1");
  });
});
