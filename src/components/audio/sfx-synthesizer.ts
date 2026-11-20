export type SoundPackId =
  | 'retro-8bit'
  | 'mechanical-keyboard'
  | 'cyberpunk-scifi'
  | 'minimalist-zen';

export type SfxEventId =
  | 'keystroke'
  | 'compile-error'
  | 'test-passed'
  | 'combo-streak'
  | 'victory-fanfare';

export interface AdsrEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SfxPackProfile {
  id: SoundPackId;
  label: string;
  description: string;
  keystrokeWave: OscillatorType;
  keystrokeFreqHz: number;
  chimeWave: OscillatorType;
  errorWave: OscillatorType;
  fmModRatio: number;
  fmModDepthHz: number;
  envelope: AdsrEnvelope;
}

export interface SfxSynthesizerConfig {
  pack: SoundPackId;
  masterVolume: number;
  sfxVolume: number;
  isMuted: boolean;
}

export const SOUND_PACK_PROFILES: Record<SoundPackId, SfxPackProfile> = {
  'retro-8bit': {
    id: 'retro-8bit',
    label: 'Retro 8-Bit',
    description: 'Crisp NES/GameBoy pulse & triangle chiptune synthesis',
    keystrokeWave: 'square',
    keystrokeFreqHz: 520,
    chimeWave: 'square',
    errorWave: 'sawtooth',
    fmModRatio: 2.0,
    fmModDepthHz: 90,
    envelope: { attack: 0.004, decay: 0.035, sustain: 0.25, release: 0.05 },
  },
  'mechanical-keyboard': {
    id: 'mechanical-keyboard',
    label: 'Mechanical Keyboard',
    description: 'Tactile Holy Panda switch thock & warm harmonic bells',
    keystrokeWave: 'triangle',
    keystrokeFreqHz: 290,
    chimeWave: 'sine',
    errorWave: 'sawtooth',
    fmModRatio: 1.5,
    fmModDepthHz: 55,
    envelope: { attack: 0.002, decay: 0.025, sustain: 0.15, release: 0.04 },
  },
  'cyberpunk-scifi': {
    id: 'cyberpunk-scifi',
    label: 'Cyberpunk Sci-Fi',
    description: 'FM-modulated neon synth sweeps and futuristic telemetry cues',
    keystrokeWave: 'sawtooth',
    keystrokeFreqHz: 680,
    chimeWave: 'triangle',
    errorWave: 'sawtooth',
    fmModRatio: 3.0,
    fmModDepthHz: 180,
    envelope: { attack: 0.006, decay: 0.045, sustain: 0.3, release: 0.08 },
  },
  'minimalist-zen': {
    id: 'minimalist-zen',
    label: 'Minimalist Zen',
    description: 'Soft sine-wave marimba droplets with gentle release curves',
    keystrokeWave: 'sine',
    keystrokeFreqHz: 410,
    chimeWave: 'sine',
    errorWave: 'triangle',
    fmModRatio: 1.0,
    fmModDepthHz: 25,
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.2, release: 0.1 },
  },
};

export class SfxSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private unlockedByUserGesture = false;
  private lastSynthesisLatencyMs = 0;

  private config: SfxSynthesizerConfig = {
    pack: 'mechanical-keyboard',
    masterVolume: 0.8,
    sfxVolume: 0.85,
    isMuted: false,
  };

  constructor(initialConfig?: Partial<SfxSynthesizerConfig>) {
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }
  }

  getConfig(): SfxSynthesizerConfig {
    return { ...this.config };
  }

  getActivePackProfile(): SfxPackProfile {
    return SOUND_PACK_PROFILES[this.config.pack];
  }

  isUnlocked(): boolean {
    return this.unlockedByUserGesture && this.ctx !== null;
  }

  getLastLatencyMs(): number {
    return this.lastSynthesisLatencyMs;
  }

  /**
   * Browser autoplay policy compliance:
   * AudioContext is created and resumed ONLY inside an explicit user gesture handler.
   */
  async unlockFromUserGesture(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyGainLevels();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.unlockedByUserGesture = true;
    return true;
  }

  setPack(pack: SoundPackId): SfxPackProfile {
    this.config.pack = pack;
    return SOUND_PACK_PROFILES[pack];
  }

  setMasterVolume(volume: number): number {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    this.applyGainLevels();
    return this.config.masterVolume;
  }

  setSfxVolume(volume: number): number {
    this.config.sfxVolume = Math.max(0, Math.min(1, volume));
    this.applyGainLevels();
    return this.config.sfxVolume;
  }

  setMuted(muted: boolean): boolean {
    this.config.isMuted = muted;
    this.applyGainLevels();
    return this.config.isMuted;
  }

  private applyGainLevels(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const effectiveMaster = this.config.isMuted ? 0 : this.config.masterVolume;
    this.masterGain.gain.setValueAtTime(effectiveMaster, now);
    this.sfxGain.gain.setValueAtTime(this.config.sfxVolume, now);
  }

  /**
   * Core FM + ADSR procedural voice generator.
   * Returns false if called before user gesture unlock or while muted.
   */
  private triggerFmVoice(params: {
    waveform: OscillatorType;
    startFreqHz: number;
    endFreqHz: number;
    durationSec: number;
    peakGain: number;
    envelope?: AdsrEnvelope;
    useFmModulation?: boolean;
    startOffsetSec?: number;
  }): boolean {
    if (!this.unlockedByUserGesture || !this.ctx || !this.sfxGain) {
      return false;
    }
    if (this.config.isMuted || this.config.masterVolume <= 0 || this.config.sfxVolume <= 0) {
      return false;
    }

    const tStartPerf = performance.now();
    const profile = this.getActivePackProfile();
    const env = params.envelope ?? profile.envelope;
    const startTime = this.ctx.currentTime + (params.startOffsetSec ?? 0);
    const endTime = startTime + params.durationSec;

    const carrier = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();

    carrier.type = params.waveform;
    carrier.frequency.setValueAtTime(params.startFreqHz, startTime);
    if (params.endFreqHz !== params.startFreqHz) {
      carrier.frequency.exponentialRampToValueAtTime(
        Math.max(20, params.endFreqHz),
        endTime,
      );
    }

    // ADSR Gain Envelope
    const attackEnd = startTime + Math.min(env.attack, params.durationSec * 0.35);
    const decayEnd = attackEnd + Math.min(env.decay, params.durationSec * 0.35);
    const releaseStart = Math.max(decayEnd, endTime - env.release);
    const sustainLevel = Math.max(0.0001, params.peakGain * env.sustain);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.linearRampToValueAtTime(params.peakGain, attackEnd);
    voiceGain.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
    voiceGain.gain.setValueAtTime(sustainLevel, releaseStart);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    let modulator: OscillatorNode | null = null;
    if (params.useFmModulation !== false && profile.fmModDepthHz > 0) {
      modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(
        params.startFreqHz * profile.fmModRatio,
        startTime,
      );
      modGain.gain.setValueAtTime(profile.fmModDepthHz, startTime);
      modGain.gain.exponentialRampToValueAtTime(1, endTime);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      modulator.start(startTime);
      modulator.stop(endTime + 0.01);
    }

    carrier.connect(voiceGain);
    voiceGain.connect(this.sfxGain);

    carrier.start(startTime);
    carrier.stop(endTime + 0.01);

    this.lastSynthesisLatencyMs = Number(
      (performance.now() - tStartPerf).toFixed(3),
    );
    return true;
  }

  /**
   * 1. Mechanical Keystroke click with subtle pitch variance
   */
  playKeystroke(pitchJitter = 1): boolean {
    const profile = this.getActivePackProfile();
    const base = profile.keystrokeFreqHz * Math.max(0.85, Math.min(1.2, pitchJitter));
    return this.triggerFmVoice({
      waveform: profile.keystrokeWave,
      startFreqHz: base,
      endFreqHz: base * 0.55,
      durationSec: 0.045,
      peakGain: 0.22,
      useFmModulation: true,
    });
  }

  /**
   * 2. Compile Error Thud — low-end downward frequency sweep
   */
  playCompileError(): boolean {
    const profile = this.getActivePackProfile();
    return this.triggerFmVoice({
      waveform: profile.errorWave,
      startFreqHz: 185,
      endFreqHz: 52,
      durationSec: 0.26,
      peakGain: 0.45,
      envelope: { attack: 0.005, decay: 0.09, sustain: 0.35, release: 0.12 },
      useFmModulation: true,
    });
  }

  /**
   * 3. Test Passed Chime — ascending major third harmonic bell
   */
  playTestPassed(): boolean {
    const profile = this.getActivePackProfile();
    const first = this.triggerFmVoice({
      waveform: profile.chimeWave,
      startFreqHz: 523.25, // C5
      endFreqHz: 523.25,
      durationSec: 0.14,
      peakGain: 0.32,
      startOffsetSec: 0,
    });
    const second = this.triggerFmVoice({
      waveform: profile.chimeWave,
      startFreqHz: 659.25, // E5
      endFreqHz: 659.25,
      durationSec: 0.2,
      peakGain: 0.36,
      startOffsetSec: 0.08,
    });
    return first && second;
  }

  /**
   * 4. Combo Streak Siren — rising FM pitch sweep scaled by streak count
   */
  playComboStreak(streakCount = 3): boolean {
    const clampedStreak = Math.max(2, Math.min(10, streakCount));
    const startHz = 360 + clampedStreak * 35;
    const endHz = startHz * 1.65;
    return this.triggerFmVoice({
      waveform: 'sawtooth',
      startFreqHz: startHz,
      endFreqHz: endHz,
      durationSec: 0.28,
      peakGain: 0.34,
      useFmModulation: true,
    });
  }

  /**
   * 5. Victory Fanfare — 4-note triumphant arpeggio (C5 - E5 - G5 - C6)
   */
  playVictoryFanfare(): boolean {
    const profile = this.getActivePackProfile();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    return notes.every((freq, idx) =>
      this.triggerFmVoice({
        waveform: profile.chimeWave,
        startFreqHz: freq,
        endFreqHz: freq,
        durationSec: idx === notes.length - 1 ? 0.38 : 0.14,
        peakGain: 0.38,
        startOffsetSec: idx * 0.1,
      }),
    );
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.unlockedByUserGesture = false;
    }
  }
}
