import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ActiveSessionsPage from "./page";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ActiveSessionsPage (/settings/sessions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "sess_curr",
              deviceName: "Windows Workstation",
              browser: "Chrome 125.0",
              os: "Windows 11",
              ipAddress: "103.212.43.12",
              location: "Bengaluru, India",
              isCurrent: true,
              deviceType: "desktop",
            },
            {
              id: "sess_mbp",
              deviceName: "MacBook Pro 16\"",
              browser: "Safari 17.4",
              os: "macOS Sonoma",
              ipAddress: "142.250.190.46",
              location: "San Francisco, United States",
              isCurrent: false,
              deviceType: "desktop",
            },
            {
              id: "sess_iphone",
              deviceName: "iPhone 15 Pro",
              browser: "CodePulse Mobile PWA",
              os: "iOS 17.5",
              ipAddress: "103.212.43.19",
              location: "Bengaluru, India",
              isCurrent: false,
              deviceType: "mobile",
            },
          ]),
      })
    );
  });

  it("renders active sessions page with header, counts, and sessions list", async () => {
    render(<ActiveSessionsPage />);

    expect(screen.getByTestId("active-sessions-page-container")).toBeInTheDocument();
    expect(screen.getByText("Active Device Sessions")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-settings-link")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
    });

    expect(screen.getByTestId("current-device-badge")).toHaveTextContent("THIS DEVICE");
    expect(screen.getAllByText("Windows Workstation").length).toBeGreaterThan(0);
    expect(screen.getByText("MacBook Pro 16\"")).toBeInTheDocument();
    expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument();
  });

  it("revokes an individual remote session on button click and shows toast", async () => {
    render(<ActiveSessionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
    });

    const revokeBtn = screen.getByTestId("revoke-btn-sess_mbp");
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(screen.queryByText("MacBook Pro 16\"")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("2 Active");
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("MacBook Pro 16\""),
      expect.any(Object)
    );
  });

  it("opens confirmation modal and revokes all other sessions when confirmed", async () => {
    render(<ActiveSessionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
    });

    const revokeAllBtn = screen.getByTestId("revoke-all-others-btn");
    fireEvent.click(revokeAllBtn);

    // Modal should be open
    expect(screen.getByTestId("revoke-all-modal")).toBeInTheDocument();
    expect(screen.getByText("Log Out All Other Sessions?")).toBeInTheDocument();

    // Confirm revocation
    const confirmBtn = screen.getByTestId("confirm-revoke-all-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("revoke-all-modal")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("1 Active");
    expect(screen.getAllByText("Windows Workstation").length).toBeGreaterThan(0);
    expect(screen.queryByText("MacBook Pro 16\"")).not.toBeInTheDocument();
    expect(screen.queryByText("iPhone 15 Pro")).not.toBeInTheDocument();
    expect(screen.getByTestId("no-remote-sessions")).toBeInTheDocument();

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Logged out 2 remote sessions"),
      expect.any(Object)
    );
  });

  it("cancels modal without revoking other sessions when Cancel is clicked", async () => {
    render(<ActiveSessionsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
    });

    const revokeAllBtn = screen.getByTestId("revoke-all-others-btn");
    fireEvent.click(revokeAllBtn);

    expect(screen.getByTestId("revoke-all-modal")).toBeInTheDocument();

    const cancelBtn = screen.getByTestId("cancel-revoke-all-btn");
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId("revoke-all-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
    expect(screen.getByText("MacBook Pro 16\"")).toBeInTheDocument();
  });
});
