import { render, screen } from "@testing-library/react";
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
});
