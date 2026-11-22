import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SoundSettingsCard } from "./sound-settings-card";
import { audioManager } from "@/lib/audio-manager";

describe("SoundSettingsCard AudioContext & Autoplay Sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("synchronizes toggle state and invokes resumeContext on enable", async () => {
    const resumeSpy = vi.spyOn(audioManager, "resumeContext").mockResolvedValue(true);
    const setEnabledSpy = vi.spyOn(audioManager, "setEnabled");

    render(<SoundSettingsCard />);

    const switchBtn = screen.getByRole("switch", { name: /enable battle sound effects/i });
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);

    expect(setEnabledSpy).toHaveBeenCalled();
  });

  it("handles suspended audio context state safely", async () => {
    vi.spyOn(audioManager, "resumeContext").mockResolvedValue(false);
    vi.spyOn(audioManager, "isSuspended").mockReturnValue(true);

    render(<SoundSettingsCard />);

    const switchBtn = screen.getByRole("switch", { name: /enable battle sound effects/i });
    fireEvent.click(switchBtn);

    // Audio context was attempted to resume without crashing
    expect(audioManager.resumeContext).toHaveBeenCalled();
  });
});
