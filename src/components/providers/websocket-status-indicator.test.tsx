import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WebSocketStatusIndicator } from "./websocket-status-indicator";

vi.mock("@/components/providers/battle-socket-provider", () => ({
  useBattleSocketStatus: () => ({
    status: "connected",
    attempt: 0,
    retry: vi.fn(),
  }),
}));

describe("WebSocketStatusIndicator - Ping Latency & Signal Bars", () => {
  it("renders ping latency badge when connected", () => {
    render(<WebSocketStatusIndicator simulatedPing={32} />);

    expect(screen.getByTestId("ping-latency-badge")).toBeInTheDocument();
    expect(screen.getByText("32ms")).toBeInTheDocument();
  });

  it("renders 4 signal bars", () => {
    render(<WebSocketStatusIndicator simulatedPing={25} />);

    const signalBars = screen.getByTestId("signal-bars");
    expect(signalBars).toBeInTheDocument();
    expect(signalBars.children.length).toBe(4);
  });
});
