/**
 * CodePulse Web Audio API Dynamic Procedural Sound Synthesizer
 * Generates interactive battle SFX and cyber instruments with 0 bytes of external audio files.
 */

export interface SynthOptions {
  masterVolume?: number; // 0.0 - 1.0
  isMuted?: boolean;
}

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.7;
  private isMuted = false;

  constructor(options: SynthOptions = {}) {
    if (options.masterVolume !== undefined) {
      this.masterVolume = Math.max(0, Math.min(1, options.masterVolume));
    }
    if (options.isMuted !== undefined) {
      this.isMuted = options.isMuted;
    }
  }

  /**
   * Initializes or unlocks Web Audio Context after user interaction
   */
  async init(customContext?: AudioContext): Promise<boolean> {
    if (customContext) {
      this.ctx = customContext;
    } else if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.ctx = new window.AudioContext();
    }

    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // user gesture required
      }
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      this.isMuted ? 0 : this.masterVolume,
      this.ctx.currentTime,
    );
    this.masterGain.connect(this.ctx.destination);

    return true;
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
      );
    }
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Subtle mechanical keyboard switch click sound
   */
  playKeystrokeClick(pitchOffsetHz = 0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400 + pitchOffsetHz, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.025);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Harmonious ascending chord chime for passing test cases (C5 -> E5 -> G5 -> C6)
   */
  playTestSuccess(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      const startTime = now + idx * 0.06;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });
  }

  /**
   * Dissonant tritone descending buzzer for failing test cases
   */
  playTestFailure(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    // Tritone interval (F#4 and C4)
    osc1.frequency.setValueAtTime(369.99, now);
    osc2.frequency.setValueAtTime(261.63, now);

    osc1.frequency.exponentialRampToValueAtTime(180, now + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(130, now + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  /**
   * Pitch-swept cyber siren for sudden death phase
   */
  playSuddenDeathSiren(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(660, now);

    // LFO frequency modulation (siren pitch wobble)
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.5, now);
    lfoGain.gain.setValueAtTime(220, now); // +/- 220 Hz sweep

    lfo.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(880, now);
    filter.Q.setValueAtTime(2.0, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 1.25);
    osc.stop(now + 1.25);
  }

  /**
   * Synthesizes an electronic percussive kick hit
   */
  playDrumKick(time?: number): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = time ?? this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Synthesizes an electronic snare or white noise hi-hat
   */
  playPercussionHit(type: 'snare' | 'hihat', time?: number): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = time ?? this.ctx.currentTime;

    // 0.05s buffer of white noise
    const bufferSize = Math.floor(this.ctx.sampleRate * (type === 'snare' ? 0.15 : 0.04));
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type === 'snare' ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(type === 'snare' ? 1200 : 7000, now);

    const gain = this.ctx.createGain();
    const duration = type === 'snare' ? 0.14 : 0.035;
    gain.gain.setValueAtTime(type === 'snare' ? 0.14 : 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
    }
    this.ctx = null;
    this.masterGain = null;
  }
}

export const soundSynthesizer = new SoundSynthesizer();
