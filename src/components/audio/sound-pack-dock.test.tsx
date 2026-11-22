import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SoundPackDock } from "./sound-pack-dock";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SoundPackDock", () => {
  it("renders sound pack dock with all default packs", () => {
    render(<SoundPackDock initialPack="retro-8bit" />);

    expect(screen.getByTestId("sound-pack-dock-container")).toBeInTheDocument();
    expect(screen.getByTestId("sound-pack-card-retro-8bit")).toBeInTheDocument();
    expect(screen.getByTestId("sound-pack-card-mechanical-keyboard")).toBeInTheDocument();
    expect(screen.getByTestId("active-badge-retro-8bit")).toHaveTextContent("ACTIVE");
  });

  it("changes active sound pack when card is clicked", () => {
    const onPackChangeMock = vi.fn();
    render(<SoundPackDock initialPack="retro-8bit" onPackChange={onPackChangeMock} />);

    const mechCard = screen.getByTestId("sound-pack-card-mechanical-keyboard");
    fireEvent.click(mechCard);

    expect(onPackChangeMock).toHaveBeenCalledWith("mechanical-keyboard");
    expect(screen.getByTestId("active-badge-mechanical-keyboard")).toBeInTheDocument();
  });

  it("allows auditioning sound samples independently without switching pack", () => {
    const onPackChangeMock = vi.fn();
    render(<SoundPackDock initialPack="retro-8bit" onPackChange={onPackChangeMock} />);

    const samplePassBtn = screen.getByTestId("sample-passed-retro-8bit");
    fireEvent.click(samplePassBtn);

    // Clicking sample does not switch active pack unnecessarily
    expect(screen.getByTestId("active-badge-retro-8bit")).toBeInTheDocument();
  });

  it("toggles mute on audio control button", () => {
    render(<SoundPackDock />);

    const muteBtn = screen.getByTestId("toggle-mute-btn");
    expect(screen.getByText("75%")).toBeInTheDocument();

    fireEvent.click(muteBtn);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
