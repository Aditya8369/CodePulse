import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DeveloperSkillMatrix } from "./developer-skill-matrix";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DeveloperSkillMatrix", () => {
  it("renders profile header and global statistics", () => {
    render(
      <DeveloperSkillMatrix
        username="codepulse-master"
        totalContributions={2400}
        currentStreak={50}
      />
    );

    expect(screen.getByTestId("developer-skill-matrix-container")).toBeInTheDocument();
    expect(screen.getByText("@codepulse-master")).toBeInTheDocument();
    expect(screen.getByTestId("total-contributions-count")).toHaveTextContent("2,400");
    expect(screen.getByTestId("current-streak-count")).toHaveTextContent("50 Days");
  });

  it("filters skills by domain tab", () => {
    render(<DeveloperSkillMatrix />);

    // Initially all skills rendered
    expect(screen.getByText("React & Next.js")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes & Docker")).toBeInTheDocument();

    // Click Backend tab
    const backendTab = screen.getByTestId("domain-tab-BACKEND");
    fireEvent.click(backendTab);

    expect(screen.getByText("Node.js & NestJS")).toBeInTheDocument();
    expect(screen.queryByText("React & Next.js")).not.toBeInTheDocument();
  });

  it("toggles between Matrix View and Contribution Heatmap View", () => {
    render(<DeveloperSkillMatrix />);

    expect(screen.getByTestId("skills-matrix-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("github-commit-heatmap-view")).not.toBeInTheDocument();

    // Switch to Heatmap
    const heatmapTab = screen.getByTestId("view-heatmap-tab");
    fireEvent.click(heatmapTab);

    expect(screen.queryByTestId("skills-matrix-grid")).not.toBeInTheDocument();
    expect(screen.getByTestId("github-commit-heatmap-view")).toBeInTheDocument();
  });

  it("opens skill detail drill-down when a skill card is clicked", () => {
    render(<DeveloperSkillMatrix />);

    const reactSkillCard = screen.getByTestId("skill-card-s-react");
    fireEvent.click(reactSkillCard);

    expect(screen.getByTestId("skill-detail-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Verified with 342 commits/i)).toBeInTheDocument();
  });

  it("triggers share toast notification when share button clicked", () => {
    render(<DeveloperSkillMatrix />);

    const shareBtn = screen.getByTestId("share-matrix-btn");
    fireEvent.click(shareBtn);
  });
});
