import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import {
  RewardUnboxingModal,
  UnboxingReward,
} from "./reward-unboxing-modal";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("RewardUnboxingModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const mockReward: UnboxingReward = {
    tier: 10,
    track: "ELITE",
    label: "Genesis Circuit Frame Mk.1",
    category: "Avatar Frame",
    rarity: "EPIC",
    xpBonus: 250,
  };

  it("renders correctly when open and reward is provided", () => {
    render(
      <RewardUnboxingModal
        isOpen={true}
        onClose={vi.fn()}
        reward={mockReward}
      />
    );

    expect(screen.getByTestId("reward-unboxing-modal")).toBeInTheDocument();
    expect(screen.getByTestId("sealed-mystery-crate")).toBeInTheDocument();
    expect(screen.getByTestId("open-mystery-crate-btn")).toBeInTheDocument();
    expect(screen.getByText(/ELITE Pass • Tier 10/i)).toBeInTheDocument();
    expect(screen.getByTestId("unboxing-rarity-badge")).toHaveTextContent("EPIC");
  });

  it("does not render when reward is null", () => {
    const { container } = render(
      <RewardUnboxingModal
        isOpen={true}
        onClose={vi.fn()}
        reward={null}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("unboxes mystery reward after clicking open crate button", () => {
    const onEquipMock = vi.fn();
    render(
      <RewardUnboxingModal
        isOpen={true}
        onClose={vi.fn()}
        reward={mockReward}
        onEquip={onEquipMock}
      />
    );

    const openBtn = screen.getByTestId("open-mystery-crate-btn");
    fireEvent.click(openBtn);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByTestId("unboxed-reward-card")).toBeInTheDocument();
    expect(screen.getByText("Genesis Circuit Frame Mk.1")).toBeInTheDocument();
    expect(screen.getByTestId("equip-unboxed-reward-btn")).toBeInTheDocument();

    // Test Equip Action
    const equipBtn = screen.getByTestId("equip-unboxed-reward-btn");
    fireEvent.click(equipBtn);
    expect(onEquipMock).toHaveBeenCalledWith(mockReward);
  });
});
