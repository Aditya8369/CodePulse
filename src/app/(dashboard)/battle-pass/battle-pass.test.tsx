import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BattlePassPage from "./page";

describe("BattlePassPage (50-Tier Seasonal Battle Pass Roadmap)", () => {
  it("completes weekly quests to auto-level tiers and claims unlocked rewards into inventory", () => {
    render(<BattlePassPage />);

    expect(screen.getByTestId("bp-current-tier").textContent).toContain("Tier 4 / 50");

    // Complete the Daily Challenge quest objective (+750 XP -> reaches Tier 5)
    const completeButtons = screen.getAllByRole("button", {
      name: /Complete Objective/i,
    });
    fireEvent.click(completeButtons[0]);

    expect(screen.getByTestId("bp-current-tier").textContent).toContain("Tier 5 / 50");

    // Claim Tier 2 Free reward -> unlocked cosmetics increases from 2 to 3
    const claimFreeButtons = screen.getAllByRole("button", {
      name: /Claim Free/i,
    });
    fireEvent.click(claimFreeButtons[0]);

    expect(screen.getByTestId("bp-inventory-count").textContent).toContain(
      "Unlocked Cosmetics: 3"
    );
  });
});
