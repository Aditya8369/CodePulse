import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

  it("keeps freeze activation disabled while inventory is unavailable", () => {
    render(<StreakCalendar today={new Date("2026-11-16T00:00:00Z")} activity={[]} currentStreak={0} />);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Equip Freeze" }).hasAttribute("disabled")).toBe(true);
  });

  it("displays streak flame particles when current streak reaches 7+ days", () => {
    render(<StreakCalendar today={new Date("2026-11-16T00:00:00Z")} activity={[]} currentStreak={8} />);
    expect(screen.getByText("8 days")).toBeTruthy();
    expect(screen.getByText("7+ Days Streak On Fire!")).toBeTruthy();
  });
});
