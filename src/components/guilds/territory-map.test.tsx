import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TerritoryMap, DEFAULT_TACTICAL_SECTORS } from "./territory-map";

describe("TerritoryMap Component", () => {
  it("renders 2D tactical battlefield canvas and all tactical sectors", () => {
    render(<TerritoryMap />);

    expect(screen.getByTestId("clan-territory-map-container")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Clan War Territory Conquest Map/i })).toBeInTheDocument();

    // Verify all 5 default sectors exist
    DEFAULT_TACTICAL_SECTORS.forEach((sec) => {
      expect(screen.getByTestId(`sector-node-${sec.id}`)).toBeInTheDocument();
    });
  });

  it("selects a sector and displays telemetry inspection details", () => {
    render(<TerritoryMap userGuildTag="AVENGER" />);

    // Click on Sector Alpha (Kernel Core)
    const alphaNode = screen.getByTestId("sector-node-sec-alpha");
    fireEvent.click(alphaNode);

    expect(screen.getByText("Sector Alpha: Kernel Core")).toBeInTheDocument();
    expect(screen.getByText(/Kernel Hackers \[KERN\]/i)).toBeInTheDocument();
  });

  it("handles filter toggling between all, contested, controlled, and neutral", () => {
    render(<TerritoryMap />);

    const contestedFilterBtn = screen.getByTestId("filter-territory-contested");
    fireEvent.click(contestedFilterBtn);

    // Contested sectors should be visible
    expect(screen.getByTestId("sector-node-sec-beta")).toBeInTheDocument();
    expect(screen.getByTestId("sector-node-sec-delta")).toBeInTheDocument();

    // Controlled or neutral sectors should be filtered out
    expect(screen.queryByTestId("sector-node-sec-alpha")).toBeNull();
  });

  it("triggers attack action callback when launch skirmish is clicked", () => {
    const handleAttack = vi.fn();
    render(<TerritoryMap userGuildTag="AVENGER" onAttackSector={handleAttack} />);

    // Sector Alpha is controlled by KERN (enemy)
    const alphaNode = screen.getByTestId("sector-node-sec-alpha");
    fireEvent.click(alphaNode);

    const attackBtn = screen.getByTestId("attack-sector-btn");
    fireEvent.click(attackBtn);

    expect(handleAttack).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sec-alpha" })
    );
  });
});
