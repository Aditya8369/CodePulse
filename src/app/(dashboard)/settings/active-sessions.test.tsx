import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ActiveSessionsTable } from "@/components/settings/active-sessions-table";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ActiveSessionsTable", () => {
  it("renders active sessions list with current device indicator", () => {
    render(<ActiveSessionsTable />);

    expect(screen.getByTestId("active-sessions-table-container")).toBeInTheDocument();
    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("4 Active");
    expect(screen.getByTestId("current-device-badge")).toHaveTextContent("THIS DEVICE");
    expect(screen.getByText("Windows Workstation")).toBeInTheDocument();
    expect(screen.getByText("MacBook Pro 16\"")).toBeInTheDocument();
  });

  it("revokes an individual remote session on button click", async () => {
    const onRevokeMock = vi.fn();
    render(<ActiveSessionsTable onRevokeSession={onRevokeMock} />);

    const revokeBtn = screen.getByTestId("revoke-btn-sess_mbp");
    await act(async () => {
      fireEvent.click(revokeBtn);
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(onRevokeMock).toHaveBeenCalledWith("sess_mbp");
    expect(screen.queryByText("MacBook Pro 16\"")).not.toBeInTheDocument();
    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("3 Active");
  });

  it("revokes all other remote sessions at once", () => {
    const onRevokeAllMock = vi.fn();
    render(<ActiveSessionsTable onRevokeAllOthers={onRevokeAllMock} />);

    const revokeAllBtn = screen.getByTestId("revoke-all-others-btn");
    fireEvent.click(revokeAllBtn);

    expect(onRevokeAllMock).toHaveBeenCalled();
    expect(screen.getByTestId("sessions-count-badge")).toHaveTextContent("1 Active");
    expect(screen.getByText("Windows Workstation")).toBeInTheDocument();
    expect(screen.queryByText("MacBook Pro 16\"")).not.toBeInTheDocument();
    expect(screen.queryByText("iPhone 15 Pro")).not.toBeInTheDocument();
  });
});
