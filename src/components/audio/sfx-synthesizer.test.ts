import { describe, it, expect, vi, beforeEach } from "vitest";
import { SfxSynthesizer } from "./sfx-synthesizer";

function createMockAudioContext() {
  const createdOscillators: Array<{
    type: OscillatorType;
    frequency: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];

  const createdGains: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];

  class MockAudioContext {
    state: AudioContextState = "suspended";
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = "running";
    });
    close = vi.fn(async () => {
      this.state = "closed";
    });
    createOscillator = vi.fn(() => {
      const osc = {
        type: "sine" as OscillatorType,
        frequency: {
          value: 440,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdOscillators.push(osc);
      return osc;
    });
    createGain = vi.fn(() => {
      const g = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      createdGains.push(g);
      return g;
    });
  }

  return { MockAudioContext, createdOscillators, createdGains };
}

describe("SfxSynthesizer (Procedural Web Audio API Synthesizer)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("enforces browser autoplay policy: blocks AudioContext creation until explicit user gesture", async () => {
    const { MockAudioContext } = createMockAudioContext();
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;

    const synth = new SfxSynthesizer();
    expect(synth.isUnlocked()).toBe(false);

    // Attempting playback prior to user gesture returns false without instantiating AudioContext
    expect(synth.playKeystroke()).toBe(false);
    expect(synth.isUnlocked()).toBe(false);

    // Unlock on user click gesture
    const unlocked = await synth.unlockFromUserGesture();
    expect(unlocked).toBe(true);
    expect(synth.isUnlocked()).toBe(true);
  });

  it("synthesizes FM-modulated oscillators, frequency ramps, and ADSR gain envelopes in < 5ms", async () => {
    const { MockAudioContext, createdOscillators, createdGains } =
      createMockAudioContext();
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;

    const synth = new SfxSynthesizer({ pack: "retro-8bit" });
    await synth.unlockFromUserGesture();

    // Compile Error Thud -> downward frequency ramp from 185Hz to 52Hz + ADSR envelope
    const playedError = synth.playCompileError();
    expect(playedError).toBe(true);
    expect(synth.getLastLatencyMs()).toBeLessThan(5);

    // Carrier + FM modulator oscillators created
    expect(createdOscillators.length).toBe(2);
    const carrier = createdOscillators[0];
    expect(carrier.type).toBe("sawtooth");
    expect(carrier.frequency.setValueAtTime).toHaveBeenCalledWith(185, 0);
    expect(carrier.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      52,
      0.26
    );

    // Voice GainNode applies Attack (linearRamp) + Decay/Release (exponentialRamp)
    const voiceGain = createdGains[createdGains.length - 2];
    expect(voiceGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(voiceGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it("synthesizes Test Passed Chime, Combo Streak Siren, and Victory Fanfare and respects pack & mute settings", async () => {
    const { MockAudioContext, createdOscillators } = createMockAudioContext();
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;

    const synth = new SfxSynthesizer({ pack: "cyberpunk-scifi" });
    await synth.unlockFromUserGesture();

    expect(synth.playTestPassed()).toBe(true);
    expect(synth.playComboStreak(5)).toBe(true);

    createdOscillators.length = 0;
    expect(synth.playVictoryFanfare()).toBe(true);
    // 4 arpeggio notes * (1 carrier + 1 FM modulator) = 8 oscillators
    expect(createdOscillators.length).toBe(8);

    // Master mute suppresses playback immediately
    synth.setMuted(true);
    expect(synth.playKeystroke()).toBe(false);

    synth.setMuted(false);
    synth.setMasterVolume(0.6);
    synth.setSfxVolume(0.75);
    synth.setPack("minimalist-zen");
    expect(synth.getConfig().pack).toBe("minimalist-zen");
    expect(synth.playKeystroke()).toBe(true);
  });
});
