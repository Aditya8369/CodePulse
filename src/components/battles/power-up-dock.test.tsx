import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PowerUpDock, POWER_UPS } from "./power-up-dock";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PowerUpDock Component - Sabotage Power-Up Dock & Animated Cooldown Radial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all 4 sabotage power-ups with their hotkeys and names", () => {
    render(<PowerUpDock />);

    expect(screen.getByText(/Sabotage Dock/i)).toBeInTheDocument();
    expect(screen.getByText("Syntax Scramble")).toBeInTheDocument();
    expect(screen.getByText("Screen Fog")).toBeInTheDocument();
    expect(screen.getByText("Variable Invert")).toBeInTheDocument();
    expect(screen.getByText("Key Delay")).toBeInTheDocument();

    POWER_UPS.forEach((p) => {
      expect(screen.getByTestId(`power-up-${p.id}`)).toBeInTheDocument();
      expect(screen.getByText(p.hotkey)).toBeInTheDocument();
    });
  });

  it("casts a power-up on click, triggers onCastPowerUp, and begins radial cooldown countdown", () => {
    const onCastPowerUp = vi.fn();
    render(<PowerUpDock onCastPowerUp={onCastPowerUp} />);

    const syntaxScrambleBtn = screen.getByTestId("power-up-SYNTAX_SCRAMBLE");
    fireEvent.click(syntaxScrambleBtn);

    expect(onCastPowerUp).toHaveBeenCalledWith("SYNTAX_SCRAMBLE");

    // Cooldown radial SVG and countdown counter appear (25s initial)
    expect(screen.getByTestId("cooldown-radial-SYNTAX_SCRAMBLE")).toBeInTheDocument();
    expect(screen.getByTestId("cooldown-counter-SYNTAX_SCRAMBLE")).toHaveTextContent("25s");

    // Advance 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("cooldown-counter-SYNTAX_SCRAMBLE")).toHaveTextContent("20s");
  });

  it("prevents casting while a power-up is on cooldown", () => {
    const onCastPowerUp = vi.fn();
    render(<PowerUpDock onCastPowerUp={onCastPowerUp} />);

    const screenFogBtn = screen.getByTestId("power-up-SCREEN_FOG");
    fireEvent.click(screenFogBtn);
    expect(onCastPowerUp).toHaveBeenCalledTimes(1);

    // Click again during cooldown
    fireEvent.click(screenFogBtn);
    expect(onCastPowerUp).toHaveBeenCalledTimes(1);
  });

  it("resets cooldown back to ready after cooldown time expires", () => {
    render(<PowerUpDock />);

    const varInvertBtn = screen.getByTestId("power-up-VARIABLE_INVERT");
    fireEvent.click(varInvertBtn);

    expect(screen.getByTestId("cooldown-counter-VARIABLE_INVERT")).toHaveTextContent("20s");

    // Advance 21 seconds to complete cooldown
    act(() => {
      vi.advanceTimersByTime(21000);
    });

    expect(screen.queryByTestId("cooldown-radial-VARIABLE_INVERT")).not.toBeInTheDocument();
    expect(screen.getByTestId("power-up-VARIABLE_INVERT")).not.toBeDisabled();
  });

  it("triggers power-up cast using keyboard hotkey (e.g. '1')", () => {
    const onCastPowerUp = vi.fn();
    render(<PowerUpDock onCastPowerUp={onCastPowerUp} />);

    fireEvent.keyDown(window, { key: "1" });
    expect(onCastPowerUp).toHaveBeenCalledWith("SYNTAX_SCRAMBLE");
  });

  it("does not trigger hotkey when user is typing in an input element", () => {
    const onCastPowerUp = vi.fn();
    render(
      <div>
        <input data-testid="test-input" />
        <PowerUpDock onCastPowerUp={onCastPowerUp} />
      </div>,
    );

    const input = screen.getByTestId("test-input");
    input.focus();

    fireEvent.keyDown(input, { key: "2" });
    expect(onCastPowerUp).not.toHaveBeenCalled();
  });
});
