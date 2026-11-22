import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DifficultyBadge, ChallengeFilterBar } from "./challenge-filter-bar";

describe("DifficultyBadge - Color-Blind Safe Indicator", () => {
  it("renders circle symbol and Roman numeral I for easy difficulty", () => {
    render(<DifficultyBadge difficulty="easy" />);
    const badge = screen.getByTestId("difficulty-badge-easy");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-shape", "circle");
    expect(screen.getByText("●")).toBeInTheDocument();
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("[I]")).toBeInTheDocument();
  });

  it("renders diamond symbol and Roman numeral II for medium difficulty", () => {
    render(<DifficultyBadge difficulty="medium" />);
    const badge = screen.getByTestId("difficulty-badge-medium");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-shape", "diamond");
    expect(screen.getByText("◆")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("[II]")).toBeInTheDocument();
  });

  it("renders triangle symbol and Roman numeral III for hard difficulty", () => {
    render(<DifficultyBadge difficulty="hard" />);
    const badge = screen.getByTestId("difficulty-badge-hard");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-shape", "triangle");
    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("[III]")).toBeInTheDocument();
  });
});

describe("ChallengeFilterBar", () => {
  it("renders difficulty filter buttons with symbols and accessibility labels", () => {
    const handleDifficultyChange = () => {};
    render(
      <ChallengeFilterBar
        searchInput=""
        onSearchInputChange={() => {}}
        categoryFilter="all"
        onCategoryFilterChange={() => {}}
        categories={["algorithms", "data_structures"]}
        difficultyFilter="easy"
        onDifficultyFilterChange={handleDifficultyChange}
      />
    );

    const easyFilterBtn = screen.getByTestId("filter-difficulty-easy");
    expect(easyFilterBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("filter-difficulty-medium")).toHaveAttribute("aria-pressed", "false");
  });
});
