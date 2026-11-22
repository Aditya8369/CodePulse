import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "./page";

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: vi.fn(),
  }),
}));

// Mock current user hook
vi.mock("@/hooks/api/use-auth", () => ({
  useCurrentUser: () => ({
    data: {
      id: "u123",
      username: "alexmercer",
      name: "Alex Mercer",
      twoFactorEnabled: false,
    },
    isLoading: false,
  }),
  useHasAuthToken: () => true,
}));

// Mock useUpdateProfile hook
vi.mock("@/hooks/api/use-settings", async () => {
  const actual = await vi.importActual<any>("@/hooks/api/use-settings");
  return {
    ...actual,
    useUpdateProfile: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

describe("SettingsPage - 19 Database Preferences Tab", () => {
  it("renders 19 DB Preferences tab and displays all preferences", () => {
    render(<SettingsPage />);

    // Click on 19 DB Preferences tab
    const prefTab = screen.getByRole("tab", { name: /19 DB Preferences/i });
    expect(prefTab).toBeInTheDocument();
    fireEvent.click(prefTab);

    // Verify presence of panel
    expect(screen.getByTestId("db-preferences-panel")).toBeInTheDocument();
    expect(screen.getByText("19 Database User Preferences")).toBeInTheDocument();

    // Verify key preferences
    expect(screen.getByTestId("db-pref-theme")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-accentColor")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-colorVisionTheme")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-developerTheme")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-compactTableView")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-reducedMotion")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-notificationsEnabled")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-emailAlerts")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-battleChallenges")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-twoFactorEnabled")).toBeInTheDocument();
    expect(screen.getByTestId("db-pref-customAccent")).toBeInTheDocument();
  });
});
