import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TournamentBracket } from "./tournament-bracket";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("TournamentBracket", () => {
  it("renders tournament header and default bracket sections", () => {
    render(<TournamentBracket />);

    expect(screen.getByTestId("tournament-bracket-view")).toBeInTheDocument();
    expect(screen.getByText("NSoC'26 CodePulse Global Masters")).toBeInTheDocument();
    expect(screen.getByTestId("upper-bracket-section")).toBeInTheDocument();
    expect(screen.getByTestId("lower-bracket-section")).toBeInTheDocument();
    expect(screen.getByTestId("grand-finals-section")).toBeInTheDocument();
  });

  it("filters bracket sections when clicking tabs", () => {
    render(<TournamentBracket />);

    // Click Winners tab
    const upperBtn = screen.getByText("Winners (Upper)");
    fireEvent.click(upperBtn);

    expect(screen.getByTestId("upper-bracket-section")).toBeInTheDocument();
    expect(screen.queryByTestId("lower-bracket-section")).not.toBeInTheDocument();

    // Click Losers tab
    const lowerBtn = screen.getByText("Losers (Lower)");
    fireEvent.click(lowerBtn);

    expect(screen.queryByTestId("upper-bracket-section")).not.toBeInTheDocument();
    expect(screen.getByTestId("lower-bracket-section")).toBeInTheDocument();
  });

  it("filters matches by search query", () => {
    render(<TournamentBracket />);

    const searchInput = screen.getByPlaceholderText("Search team or round...");
    fireEvent.change(searchInput, { target: { value: "GlitchHunters" } });

    expect(screen.getByText("GlitchHunters")).toBeInTheDocument();
    expect(screen.queryByText("ZeroDay Syndicate")).not.toBeInTheDocument();
  });

  it("opens match detail dialog when match card is clicked", () => {
    const onSelectMatchMock = vi.fn();
    render(<TournamentBracket onSelectMatch={onSelectMatchMock} />);

    const matchCard = screen.getByTestId("match-card-ub-m1");
    fireEvent.click(matchCard);

    expect(onSelectMatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ub-m1" })
    );
    expect(screen.getByTestId("match-detail-dialog")).toBeInTheDocument();
    expect(screen.getByText("Upper Quarterfinals")).toBeInTheDocument();
  });

  it("displays LIVE badge for live matches", () => {
    render(<TournamentBracket />);

    expect(screen.getByTestId("match-live-badge-ub-m7")).toBeInTheDocument();
    expect(screen.getByTestId("match-live-badge-ub-m7")).toHaveTextContent("LIVE");
  });
});
