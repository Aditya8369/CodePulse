import { beforeEach, describe, expect, it, vi } from "vitest";

const oscillators: Array<{ type: OscillatorType }> = [];
const masterVolume = vi.fn();

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        setTargetAtTime: masterVolume,
      },
      connect: vi.fn(),
    };
  }
  createOscillator() {
    const oscillator = {
      type: "sine" as OscillatorType,
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  resume() { return Promise.resolve(); }
}

async function manager() {
  vi.resetModules();
  return (await import("./audio-manager")).audioManager;
}

describe("AudioManager sound packs", () => {
  beforeEach(() => {
    localStorage.clear();
    oscillators.length = 0;
    masterVolume.mockClear();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
  });

  it("persists theme, zero volume, and category switches across reloads", async () => {
    const audio = await manager();
    audio.setTheme("retro");
    audio.setVolume(0);
    audio.setCategoryEnabled("round", false);
    const reloaded = await manager();
    expect(reloaded.getTheme()).toBe("retro");
    expect(reloaded.getVolume()).toBe(0);
    expect(reloaded.isCategoryEnabled("round")).toBe(false);
    reloaded.playRoundChime(true);
    expect(oscillators).toHaveLength(0);
  });

  it("switches synthesized waveforms and adjusts the live master gain", async () => {
    const audio = await manager();
    audio.setTheme("retro");
    audio.playPreviewChime();
    expect(oscillators[0].type).toBe("square");
    audio.setTheme("cyber");
    audio.playPreviewChime();
    expect(oscillators.at(-1)?.type).toBe("sawtooth");
    audio.setVolume(0.25);
    expect(masterVolume).toHaveBeenCalledWith(0.25, 0, 0.03);
    const before = oscillators.length;
    audio.setCategoryEnabled("victory", false);
    audio.playVictoryFanfare();
    expect(oscillators).toHaveLength(before);
    audio.setCategoryEnabled("victory", true);
    audio.playVictoryFanfare();
    expect(oscillators.length).toBeGreaterThan(before);
  });

  it("respects global mute", async () => {
    const audio = await manager();
    audio.setEnabled(false);
    audio.playPreviewChime();
    expect(oscillators).toHaveLength(0);
  });
});
