import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ConnectionDiagnosticsModal } from "./connection-diagnostics-modal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ConnectionDiagnosticsModal", () => {
  it("renders connection quality diagnostics modal with metrics", () => {
    render(<ConnectionDiagnosticsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("connection-diagnostics-modal-dialog")).toBeInTheDocument();
    expect(screen.getByText("WebSocket Connection Quality & Diagnostics")).toBeInTheDocument();
    expect(screen.getByTestId("avg-rtt-stat")).toBeInTheDocument();
    expect(screen.getByTestId("jitter-stat")).toBeInTheDocument();
    expect(screen.getByTestId("packet-loss-stat")).toBeInTheDocument();
    expect(screen.getByTestId("latency-sparkline-section")).toBeInTheDocument();
  });

  it("runs interactive ping probe test when clicking button", async () => {
    const onProbeCompleteMock = vi.fn();
    render(
      <ConnectionDiagnosticsModal
        isOpen={true}
        onClose={vi.fn()}
        onProbeComplete={onProbeCompleteMock}
      />
    );

    const probeBtn = screen.getByTestId("run-probe-btn");
    await act(async () => {
      fireEvent.click(probeBtn);
      await new Promise((r) => setTimeout(r, 800));
    });

    expect(onProbeCompleteMock).toHaveBeenCalled();
  });

  it("exports telemetry JSON on button click", () => {
    render(<ConnectionDiagnosticsModal isOpen={true} onClose={vi.fn()} />);

    const exportBtn = screen.getByTestId("export-telemetry-btn");
    fireEvent.click(exportBtn);
  });
});
