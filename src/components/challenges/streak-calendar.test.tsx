import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { StreakCalendar } from "./streak-calendar";

afterEach(cleanup);

describe("StreakCalendar", () => {
  it("shows synced activity and navigates months", () => {
    render(<StreakCalendar today={new Date("2026-11-16T00:00:00Z")} activity={[{ date: "2026-11-03", count: 2 }]} currentStreak={2} />);
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(screen.getByLabelText("2026-11-03: 2 contributions")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.queryByLabelText("2026-11-03: 2 contributions")).toBeNull();
  });

  it("opens streak freeze purchase modal and completes purchase", () => {
    render(<StreakCalendar today={new Date("2026-11-16T00:00:00Z")} activity={[]} currentStreak={5} freezeInventory={1} />);
    
    // Open modal
    const openModalBtn = screen.getByTestId("open-streak-freeze-modal-btn");
    fireEvent.click(openModalBtn);

    expect(screen.getByTestId("streak-freeze-purchase-modal")).toBeInTheDocument();
    expect(screen.getByText("Streak Freeze Protection")).toBeInTheDocument();

    // Increase quantity
    const plusBtn = screen.getByTestId("freeze-qty-plus");
    fireEvent.click(plusBtn);
    expect(screen.getByTestId("freeze-qty-display")).toHaveTextContent("2");

    // Confirm purchase
    const confirmBtn = screen.getByTestId("confirm-purchase-freeze-btn");
    fireEvent.click(confirmBtn);

    // Inventory updated from 1 to 3
    expect(screen.getByText("3 available")).toBeInTheDocument();
  });

  it("displays streak flame particles when current streak reaches 7+ days", () => {
    render(<StreakCalendar today={new Date("2026-11-16T00:00:00Z")} activity={[]} currentStreak={8} />);
    expect(screen.getByText("8 days")).toBeTruthy();
    expect(screen.getByText("7+ Days Streak On Fire!")).toBeTruthy();
  });
});
