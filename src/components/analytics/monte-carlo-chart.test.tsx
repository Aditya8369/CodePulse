import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MonteCarloChart, simulateClientMonteCarlo } from "./monte-carlo-chart";

describe("MonteCarloChart (Probabilistic Burndown Fan Chart & Target Scope)", () => {
  it("computes valid P50 <= P85 <= P95 forecast dates and updates dynamically when target scope changes", () => {
    const sim = simulateClientMonteCarlo(20, [1, 3, 4, 2, 5], "2026-11-23");
    expect(sim.p50Days).toBeLessThanOrEqual(sim.p85Days);
    expect(sim.p85Days).toBeLessThanOrEqual(sim.p95Days);

    render(
      <MonteCarloChart
        sprintName="Sprint 24 • Core Engine"
        dailyThroughputSamples={[1, 3, 4, 2, 5]}
        initialRemainingTasks={20}
        startDateIso="2026-11-23"
        riskFactors={[
          {
            taskId: "T-1",
            title: "LLVM JIT Register Allocator",
            riskLevel: "HIGH",
            reason: "high throughput variance (CV=0.68)",
          },
        ]}
      />
    );

    const initialP85 = screen.getByTestId("mc-p85-date").textContent;
    expect(screen.getByTestId("mc-fan-chart-svg")).toBeDefined();
    expect(screen.getByTestId("mc-risk-factors").textContent).toContain(
      "LLVM JIT Register Allocator"
    );

    // Double target scope -> P85 completion date shifts later
    fireEvent.change(screen.getByLabelText("Target Scope Tasks"), {
      target: { value: "60" },
    });
    const updatedP85 = screen.getByTestId("mc-p85-date").textContent;
    expect(updatedP85).not.toBe(initialP85);
  });
});
