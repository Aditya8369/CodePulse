import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminFinOpsDashboardPage from "./page";

describe("AdminFinOpsDashboardPage (Cloud Spend Breakdown & Reaper Controls)", () => {
  it("displays daily, monthly, and annual savings and toggles 10 PM - 7 AM sleep policy", () => {
    render(<AdminFinOpsDashboardPage />);

    expect(screen.getByTestId("finops-daily-savings").textContent).toContain("$34.83 / day");
    expect(screen.getByTestId("finops-monthly-savings").textContent).toContain("$1,045 / mo");
    expect(screen.getByTestId("finops-annual-savings").textContent).toContain("$12,713 / yr");

    const toggleBtn = screen.getByTestId("toggle-overnight-sleep");
    expect(toggleBtn.textContent).toContain("ACTIVE");
    fireEvent.click(toggleBtn);
    expect(toggleBtn.textContent).toContain("PAUSED");
  });
});
