import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BattleLiveRoom } from "./battle-live-room";

// Mock the battle socket hook
vi.mock("@/components/providers/battle-socket-provider", () => ({
  useBattleSocketStatus: () => ({
    status: "connected",
    attempt: 0,
    retry: vi.fn(),
    socket: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
}));

describe("BattleLiveRoom Component", () => {
  it("renders both players and waiting states correctly", () => {
    render(
      <BattleLiveRoom
        battleId="test-room-12345"
        currentUsername="alexmercer"
        opponentUsername="codeninja"
        onBattleStart={vi.fn()}
      />
    );

    expect(screen.getByText("@alexmercer")).toBeInTheDocument();
    expect(screen.getByText("@codeninja")).toBeInTheDocument();
    expect(screen.getByText("ROOM: #test-roo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I'm Ready — Start Battle/i })).toBeInTheDocument();
  });

  it("updates player ready status when lock-in button is clicked", () => {
    render(
      <BattleLiveRoom
        battleId="test-room-12345"
        currentUsername="alexmercer"
        opponentUsername="codeninja"
        onBattleStart={vi.fn()}
      />
    );

    const readyBtn = screen.getByTestId("lock-in-ready-btn");
    fireEvent.click(readyBtn);

    expect(screen.getByTestId("ready-badge-self")).toBeInTheDocument();
    expect(screen.getByText("Locked In — Awaiting Opponent")).toBeInTheDocument();
  });
});
