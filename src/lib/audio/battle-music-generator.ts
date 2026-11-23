/**
 * CodePulse Procedural Generative Battle Music Generator
 * Procedurally synthesizes a dynamic electronic soundtrack scaling BPM from 110 to 140
 * as match tension rises and timer counts down to sudden death.
 */

import { SoundSynthesizer, soundSynthesizer } from './sound-synthesizer';

export type MusicTensionMode = 'CALM_LOBBY' | 'BATTLE_ACTIVE' | 'HIGH_INTENSITY' | 'SUDDEN_DEATH';

export interface MusicGeneratorConfig {
  baseBpm?: number; // 110
  maxBpm?: number; // 140
  tensionMode?: MusicTensionMode;
}

// D Dorian Cyberpunk Scale Frequencies (Hz)
const SCALE_FREQUENCIES: number[] = [
  146.83, // D3 (Root)
  174.61, // F3 (Minor 3rd)
  196.00, // G3 (4th)
  220.00, // A3 (5th)
  261.63, // C4 (Minor 7th)
  293.66, // D4 (Octave)
  329.63, // E4 (9th)
  349.23, // F4 (Minor 10th)
  392.00, // G4 (11th)
  440.00, // A4 (12th)
  523.25, // C5
  587.33, // D5
];

export class BattleMusicGenerator {
  private synth: SoundSynthesizer;
  private isPlaying = false;
  private currentBpm = 110;
  private baseBpm = 110;
  private maxBpm = 140;
  private tensionMode: MusicTensionMode = 'BATTLE_ACTIVE';
  private timerId: ReturnType<typeof setInterval> | null = null;
  private currentStep = 0;

  constructor(synth: SoundSynthesizer = soundSynthesizer, config: MusicGeneratorConfig = {}) {
    this.synth = synth;
    this.baseBpm = config.baseBpm ?? 110;
    this.maxBpm = config.maxBpm ?? 140;
    this.currentBpm = this.baseBpm;
    if (config.tensionMode) this.tensionMode = config.tensionMode;
  }

  /**
   * Calculates procedural BPM scaling from 110 up to 140 based on remaining match time
   */
  calculateBpm(
    timeRemainingSec: number,
    totalDurationSec = 300,
    isSuddenDeath = false,
  ): number {
    if (isSuddenDeath || this.tensionMode === 'SUDDEN_DEATH') {
      return this.maxBpm;
    }

    if (timeRemainingSec <= 60) {
      // Rapid ramp from 125 up to 140 in final minute
      const ratio = Math.max(0, Math.min(1, (60 - timeRemainingSec) / 60));
      return Math.round(125 + ratio * (this.maxBpm - 125));
    }

    const progress = Math.max(
      0,
      Math.min(1, (totalDurationSec - timeRemainingSec) / Math.max(1, totalDurationSec - 60)),
    );
    return Math.round(this.baseBpm + progress * 15);
  }

  /**
   * Dynamically adapts musical tension based on match state
   */
  setMatchTension(timeRemainingSec: number, totalDurationSec = 300, isSuddenDeath = false): void {
    const calculatedBpm = this.calculateBpm(timeRemainingSec, totalDurationSec, isSuddenDeath);
    this.currentBpm = calculatedBpm;

    if (isSuddenDeath) {
      this.tensionMode = 'SUDDEN_DEATH';
    } else if (timeRemainingSec <= 60) {
      this.tensionMode = 'HIGH_INTENSITY';
    } else {
      this.tensionMode = 'BATTLE_ACTIVE';
    }
  }

  getCurrentBpm(): number {
    return this.currentBpm;
  }

  getTensionMode(): MusicTensionMode {
    return this.tensionMode;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Starts procedural music synthesis loop
   */
  async start(): Promise<void> {
    if (this.isPlaying) return;
    await this.synth.init();

    this.isPlaying = true;
    this.currentStep = 0;

    // 16th note interval calculation: (60 / BPM) / 4 seconds
    const intervalMs = (60000 / this.currentBpm) / 4;
    this.timerId = setInterval(() => {
      this.step();
    }, intervalMs);
  }

  /**
   * Step sequencer scheduling note events ahead
   */
  private step(): void {
    if (!this.isPlaying) return;

    const ctx = this.synth.getAudioContext();
    if (!ctx || this.synth.getIsMuted()) {
      this.currentStep = (this.currentStep + 1) % 16;
      return;
    }

    const now = ctx.currentTime + 0.05;

    // 1. Kick on beats 0, 4, 8, 12 (Four-on-the-floor)
    if (this.currentStep % 4 === 0) {
      this.synth.playDrumKick(now);
    }

    // 2. Snare on beats 4, 12
    if (this.currentStep === 4 || this.currentStep === 12) {
      this.synth.playPercussionHit('snare', now);
    }

    // 3. Hi-hats on off-beats (2, 6, 10, 14, or every 16th note in sudden death)
    if (this.tensionMode === 'SUDDEN_DEATH' || this.currentStep % 2 === 0) {
      this.synth.playPercussionHit('hihat', now);
    }

    // 4. Arpeggiator Lead Note
    const noteIndex = (this.currentStep * 3) % SCALE_FREQUENCIES.length;
    const freq = SCALE_FREQUENCIES[noteIndex];
    this.playArpNote(ctx, freq, now);

    this.currentStep = (this.currentStep + 1) % 16;
  }

  private playArpNote(ctx: AudioContext, frequency: number, time: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, time);

    filter.type = 'lowpass';
    // Open filter cutoff as tension rises
    const cutoff = this.tensionMode === 'SUDDEN_DEATH' ? 3200 : 1600;
    filter.frequency.setValueAtTime(cutoff, time);

    const noteDuration = 0.08;
    gain.gain.setValueAtTime(0.04, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + noteDuration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + noteDuration + 0.01);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

export const battleMusicGenerator = new BattleMusicGenerator();
