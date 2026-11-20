import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CooperativeRaidBossPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "hydra-raid-test" }),
}));

describe("CooperativeRaidBossPage (Multi-Phase 4-Player Boss Raid UI)", () => {
  it("progresses through Phase 1 shield break, Phase 2 core damage, and Phase 3 victory with MVP award", () => {
    render(<CooperativeRaidBossPage />);

    expect(screen.getByText("The Memory Leak Hydra")).toBeDefined();
    expect(screen.getByTestId("raid-shield-readout").textContent).toContain("250,000");

    const strikeBtn = screen.getByRole("button", {
      name: /Execute Refactor Strike/i,
    });

    // Strike 1: Shatters Phase 1 shield -> advances to Phase 2
    fireEvent.click(strikeBtn);
    expect(screen.getByTestId("raid-shield-readout").textContent).toContain("0 / 250,000");
    expect(screen.getByText(/Phase II: Collapse Asymptotic Complexity/i)).toBeDefined();

    // Strike 2: Deals 650,000 core damage -> advances to Phase 3
    fireEvent.click(strikeBtn);
    expect(screen.getByTestId("raid-hp-readout").textContent).toContain("350,000 / 1,000,000");
    expect(screen.getByText(/Phase III: Patch Concurrency Deadlocks/i)).toBeDefined();

    // Strike 3: Defeats boss -> displays Victory banner & MVP badge
    fireEvent.click(strikeBtn);
    expect(screen.getByTestId("raid-hp-readout").textContent).toContain("0 / 1,000,000");
    expect(screen.getByTestId("raid-victory-banner")).toBeDefined();
    expect(screen.getByText("MVP")).toBeDefined();
  });
});
