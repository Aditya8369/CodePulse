import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { RepositoryMetricsCard } from "./repository-metrics-card";

describe("RepositoryMetricsCard", () => {
  const defaultProps = {
    repoName: "super-long-repository-name-that-would-overflow-grid-container-layout",
    commitsCount: 1420,
    openIssuesCount: 12,
    openPrsCount: 6,
    languages: [
      { name: "TypeScript", percentage: 75, color: "#3178c6" },
      { name: "CSS", percentage: 25, color: "#563d7c" },
    ],
  };

  it("renders with repo name title attribute for tooltip and truncate class", () => {
    render(<RepositoryMetricsCard {...defaultProps} />);
    const titleElement = screen.getByTestId("repo-title");
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveAttribute(
      "title",
      "super-long-repository-name-that-would-overflow-grid-container-layout"
    );
    expect(titleElement.className).toContain("truncate");
  });

  it("renders metric numbers accurately", () => {
    render(<RepositoryMetricsCard {...defaultProps} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("6 Open")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("switches to DORA metrics tab and displays DORA badges and overall tier", () => {
    render(<RepositoryMetricsCard {...defaultProps} />);
    const doraTabBtn = screen.getByTestId("tab-dora-btn");
    fireEvent.click(doraTabBtn);

    expect(screen.getByTestId("dora-metrics-section")).toBeInTheDocument();
    expect(screen.getByTestId("dora-overall-tier")).toHaveTextContent(/Elite Performer/i);
    expect(screen.getByText("Deployment Frequency")).toBeInTheDocument();
    expect(screen.getByText("Lead Time for Changes")).toBeInTheDocument();
    expect(screen.getByText("Change Failure Rate")).toBeInTheDocument();
    expect(screen.getByText("Time to Restore Service")).toBeInTheDocument();
  });

  it("switches to Tech Radar tab and renders radar dimensions", () => {
    render(<RepositoryMetricsCard {...defaultProps} />);
    const radarTabBtn = screen.getByTestId("tab-radar-btn");
    fireEvent.click(radarTabBtn);

    expect(screen.getByTestId("tech-radar-section")).toBeInTheDocument();
    expect(screen.getByLabelText("Repository Health & Tech Stack Radar Chart")).toBeInTheDocument();
    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Test Coverage")).toBeInTheDocument();
  });
});
