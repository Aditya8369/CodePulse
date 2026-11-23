import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SessionItem, type DeviceSession } from "./session-item";

describe("SessionItem Component", () => {
  const currentSession: DeviceSession = {
    id: "sess-curr-1",
    deviceName: "Windows Workstation",
    browser: "Chrome 125.0",
    os: "Windows 11",
    ipAddress: "103.212.43.12",
    location: "Bengaluru, India",
    lastActive: "Active Now",
    isCurrent: true,
    deviceType: "desktop",
  };

  const remoteLaptopSession: DeviceSession = {
    id: "sess-mbp-2",
    deviceName: "MacBook Pro 16\"",
    browser: "Safari 17.4",
    os: "macOS Sonoma",
    ipAddress: "142.250.190.46",
    location: "San Francisco, United States",
    lastActive: "2 hours ago",
    isCurrent: false,
    deviceType: "desktop",
  };

  const remoteMobileSession: DeviceSession = {
    id: "sess-phone-3",
    deviceName: "iPhone 15 Pro",
    browser: "CodePulse Mobile PWA",
    os: "iOS 17.5",
    ipAddress: "103.212.43.19",
    location: "Bengaluru, India",
    lastActive: "Yesterday at 18:42",
    isCurrent: false,
    deviceType: "mobile",
  };

  const remoteTabletSession: DeviceSession = {
    id: "sess-ipad-4",
    deviceName: "iPad Air",
    browser: "Chrome iOS",
    os: "iPadOS 17.4",
    ipAddress: "49.207.210.88",
    location: "Mumbai, India",
    lastActive: "3 days ago",
    isCurrent: false,
    deviceType: "tablet",
  };

  it("renders current device session with 'THIS DEVICE' badge and active indicator", () => {
    render(<SessionItem session={currentSession} />);

    expect(screen.getByTestId("session-item-sess-curr-1")).toBeInTheDocument();
    expect(screen.getByText("Windows Workstation")).toBeInTheDocument();
    expect(screen.getByText("Chrome 125.0")).toBeInTheDocument();
    expect(screen.getByText("Windows 11")).toBeInTheDocument();
    expect(screen.getByText("Bengaluru, India")).toBeInTheDocument();
    expect(screen.getByText("(103.212.43.12)")).toBeInTheDocument();

    const currentBadge = screen.getByTestId("current-device-badge");
    expect(currentBadge).toHaveTextContent("THIS DEVICE");
    expect(screen.getByText("Active Now")).toBeInTheDocument();
    expect(screen.queryByTestId("revoke-btn-sess-curr-1")).not.toBeInTheDocument();
  });

  it("renders remote laptop session with laptop icon and revoke button", () => {
    const onRevokeMock = vi.fn();
    render(<SessionItem session={remoteLaptopSession} onRevoke={onRevokeMock} />);

    expect(screen.getByTestId("device-icon-laptop")).toBeInTheDocument();
    expect(screen.getByTestId("remote-device-badge")).toHaveTextContent("Remote Device");

    const revokeBtn = screen.getByTestId("revoke-btn-sess-mbp-2");
    expect(revokeBtn).toHaveTextContent("Revoke Session");

    fireEvent.click(revokeBtn);
    expect(onRevokeMock).toHaveBeenCalledTimes(1);
    expect(onRevokeMock).toHaveBeenCalledWith("sess-mbp-2");
  });

  it("renders mobile and tablet device icons accurately", () => {
    const { rerender } = render(<SessionItem session={remoteMobileSession} />);
    expect(screen.getByTestId("device-icon-mobile")).toBeInTheDocument();

    rerender(<SessionItem session={remoteTabletSession} />);
    expect(screen.getByTestId("device-icon-tablet")).toBeInTheDocument();
  });

  it("shows loading state when isRevoking is true", () => {
    render(<SessionItem session={remoteLaptopSession} isRevoking={true} />);

    const revokeBtn = screen.getByTestId("revoke-btn-sess-mbp-2");
    expect(revokeBtn).toHaveTextContent("Revoking...");
    expect(revokeBtn).toBeDisabled();
  });
});
