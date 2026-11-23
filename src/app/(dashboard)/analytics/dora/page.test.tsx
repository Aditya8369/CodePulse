import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DoraMetricsDashboardPage from "./page";

describe("DoraMetricsDashboardPage (30D/90D/1Y Historical Comparison & Tier Classification)", () => {
  it("renders all 4 DORA metrics, performance tier badge, and switches historical windows", () => {
    render(<DoraMetricsDashboardPage />);

    expect(screen.getByTestId("dora-tier-badge").textContent).toContain("Elite Performer");
    expect(screen.getByTestId("dora-df-value").textContent).toContain("2.40 / day");
    expect(screen.getByTestId("dora-ltfc-value").textContent).toContain("6.2 hrs");
    expect(screen.getByTestId("dora-mttr-value").textContent).toContain("0.45 hrs");
    expect(screen.getByTestId("dora-cfr-value").textContent).toContain("4.2%");

    // Switch to 90D window -> updates tier & metrics
    fireEvent.click(screen.getByRole("button", { name: "90d" }));
    expect(screen.getByTestId("dora-tier-badge").textContent).toContain("High Performer");
    expect(screen.getByTestId("dora-df-value").textContent).toContain("1.50 / day");
  });
});
