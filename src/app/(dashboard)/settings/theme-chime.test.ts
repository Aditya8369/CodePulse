import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioManager } from "@/lib/audio-manager";

describe("Theme & Accent Sound Chime Preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("plays preview chime via AudioManager singleton without error", () => {
    const audio = AudioManager.getInstance();
    const playSpy = vi.spyOn(audio, "playPreviewChime");

    audio.playPreviewChime();
    expect(playSpy).toHaveBeenCalledTimes(1);
  });
});
