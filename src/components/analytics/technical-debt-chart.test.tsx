import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  TechnicalDebtChart,
  build30DayDegradationSeries,
  build3MonthHorizonSeries,
} from "./technical-debt-chart";

describe("TechnicalDebtChart Component", () => {
  it("renders accurately with default KPI metrics, rating badge, and SVG chart", () => {
    render(
      <TechnicalDebtChart
        repositoryId="test-repo-123"
        repositoryName="codepulse-core"
        initialMaintainabilityIndex={74.5}
        initialRating="B"
      />
    );

    expect(screen.getByTestId("technical-debt-forecast-card")).toBeDefined();
    expect(screen.getByTestId("sqale-rating-badge").textContent).toContain("Rating B");
    expect(screen.getByTestId("current-mi-value").textContent).toContain("74.5");
    expect(screen.getByTestId("technical-debt-chart-svg")).toBeDefined();
    expect(screen.getByTestId("hotspots-list")).toBeDefined();
    expect(screen.getByTestId("hotspot-item-1")).toBeDefined();
  });

  it("toggles between 30-Day Curve and 3-Month Horizon views", () => {
    render(
      <TechnicalDebtChart
        repositoryId="test-repo-123"
        repositoryName="codepulse-core"
        initialMaintainabilityIndex={70.0}
      />
    );

    const toggle3Month = screen.getByTestId("toggle-3month");
    fireEvent.click(toggle3Month);

    // After clicking 3-month horizon, timeline changes
    expect(screen.getByTestId("projected-mi-value")).toBeDefined();

    const toggle30Day = screen.getByTestId("toggle-30day");
    fireEvent.click(toggle30Day);
    expect(screen.getByTestId("projected-mi-value")).toBeDefined();
  });

  it("simulates refactoring to bend degradation curve upward and improve projected MI", () => {
    render(
      <TechnicalDebtChart
        repositoryId="test-repo-123"
        repositoryName="codepulse-core"
        initialMaintainabilityIndex={65.0}
      />
    );

    const initialProjected = screen.getByTestId("projected-mi-value").textContent;
    const refactorBtn = screen.getByTestId("simulate-refactor-btn");

    fireEvent.click(refactorBtn);

    const updatedProjected = screen.getByTestId("projected-mi-value").textContent;
    expect(updatedProjected).not.toBe(initialProjected);
    expect(Number(updatedProjected)).toBeGreaterThan(Number(initialProjected));
  });

  it("expands hotspot item and displays actionable refactoring recommendations", () => {
    render(
      <TechnicalDebtChart
        repositoryId="test-repo-123"
        repositoryName="codepulse-core"
      />
    );

    // First hotspot is expanded by default
    expect(screen.getByTestId("hotspot-details-1")).toBeDefined();
    expect(screen.getByText(/Decompose nested conditionals/i)).toBeDefined();

    // Click on hotspot 2 to toggle its details
    const hotspot2 = screen.getByTestId("hotspot-item-2");
    fireEvent.click(hotspot2.querySelector("div")!);

    expect(screen.getByTestId("hotspot-details-2")).toBeDefined();
  });

  it("computes mathematical 30-day and 3-month degradation series within valid boundaries", () => {
    const series30 = build30DayDegradationSeries(75);
    expect(series30.length).toBeGreaterThan(5);
    for (const pt of series30) {
      expect(pt.confidenceLow).toBeLessThanOrEqual(pt.maintainabilityIndex);
      expect(pt.confidenceHigh).toBeGreaterThanOrEqual(pt.maintainabilityIndex);
      expect(pt.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(pt.maintainabilityIndex).toBeLessThanOrEqual(100);
    }

    const series3m = build3MonthHorizonSeries(75);
    expect(series3m.length).toBe(7); // -3 to +3
    for (const pt of series3m) {
      expect(pt.confidenceLow).toBeLessThanOrEqual(pt.maintainabilityIndex);
      expect(pt.confidenceHigh).toBeGreaterThanOrEqual(pt.maintainabilityIndex);
    }
  });
});
