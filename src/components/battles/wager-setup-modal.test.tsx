import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WagerSetupModal } from "./wager-setup-modal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("WagerSetupModal Component - PulseBits XP Staking Slider & Odds Calculator", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    opponentUsername: "ninjaCoder",
    userAvailableXp: 500,
    oddsMultiplier: 2.0,
    minWager: 25,
    onConfirmWager: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<WagerSetupModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/PulseBits Staking & Odds/i)).not.toBeInTheDocument();
  });

  it("renders modal with initial state, balance, and calculations", () => {
    render(<WagerSetupModal {...defaultProps} />);

    expect(screen.getByText(/PulseBits Staking & Odds/i)).toBeInTheDocument();
    expect(screen.getByText(/@ninjaCoder/i)).toBeInTheDocument();
    expect(screen.getByTestId("user-available-xp")).toHaveTextContent("500 XP");

    // Default stake is 100 XP with 2.0x odds
    expect(screen.getByTestId("potential-payout")).toHaveTextContent("200 XP");
    expect(screen.getByTestId("net-profit")).toHaveTextContent("+100 XP");
    expect(screen.getByTestId("odds-multiplier-badge")).toHaveTextContent("2.00x Odds");
  });

  it("updates potential payout and net profit when slider value changes", () => {
    render(<WagerSetupModal {...defaultProps} oddsMultiplier={2.5} />);

    const slider = screen.getByTestId("wager-range-slider");
    fireEvent.change(slider, { target: { value: "200" } });

    // 200 * 2.5 = 500 XP payout, net profit = 300 XP
    expect(screen.getByTestId("potential-payout")).toHaveTextContent("500 XP");
    expect(screen.getByTestId("net-profit")).toHaveTextContent("+300 XP");
  });

  it("sets 50% of available XP when 50% quick chip is clicked", () => {
    render(<WagerSetupModal {...defaultProps} userAvailableXp={400} />);

    const chip50 = screen.getByRole("button", { name: "50%" });
    fireEvent.click(chip50);

    const input = screen.getByTestId("wager-amount-input") as HTMLInputElement;
    expect(input.value).toBe("200");
  });

  it("sets maximum available XP when MAX chip is clicked", () => {
    render(<WagerSetupModal {...defaultProps} userAvailableXp={350} />);

    const maxChip = screen.getByRole("button", { name: "MAX" });
    fireEvent.click(maxChip);

    const input = screen.getByTestId("wager-amount-input") as HTMLInputElement;
    expect(input.value).toBe("350");
  });

  it("disables confirm button and shows warning when amount exceeds available XP", () => {
    render(<WagerSetupModal {...defaultProps} userAvailableXp={100} />);

    const input = screen.getByTestId("wager-amount-input");
    fireEvent.change(input, { target: { value: "300" } });

    expect(screen.getByTestId("insufficient-xp-warning")).toBeInTheDocument();
    const confirmButton = screen.getByTestId("confirm-wager-button");
    expect(confirmButton).toBeDisabled();
  });

  it("calls onConfirmWager and onClose upon valid confirmation", () => {
    const onConfirmWager = vi.fn();
    const onClose = vi.fn();

    render(
      <WagerSetupModal
        {...defaultProps}
        onConfirmWager={onConfirmWager}
        onClose={onClose}
      />,
    );

    const confirmButton = screen.getByTestId("confirm-wager-button");
    fireEvent.click(confirmButton);

    expect(onConfirmWager).toHaveBeenCalledWith(100, 200);
    expect(onClose).toHaveBeenCalled();
  });
});
