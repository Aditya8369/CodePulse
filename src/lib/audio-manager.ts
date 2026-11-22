import { SOUND_PACKS, isSoundTheme, type SoundCategory, type SoundEvent, type SoundTheme } from "./sounds";

const STORAGE_SOUND_ENABLED = "codepulse_sound_enabled";
const STORAGE_SOUND_VOLUME = "codepulse_sound_volume";
const STORAGE_SOUND_THEME = "codepulse_sound_theme";
const STORAGE_SOUND_CATEGORIES = "codepulse_sound_categories";

const DEFAULT_CATEGORIES: Record<SoundCategory, boolean> = {
  countdown: true,
  round: true,
  victory: true,
};

class AudioManager {
  private static instance: AudioManager;
  private soundEnabled = true;
  private volume = 0.7;
  private theme: SoundTheme = "minimal";
  private categories = { ...DEFAULT_CATEGORIES };
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private constructor() {
    if (typeof window === "undefined") return;
    try {
      const enabled = localStorage.getItem(STORAGE_SOUND_ENABLED);
      if (enabled !== null) this.soundEnabled = enabled === "true";
      const storedVolume = localStorage.getItem(STORAGE_SOUND_VOLUME);
      if (storedVolume !== null && Number.isFinite(Number(storedVolume))) {
        this.volume = Math.max(0, Math.min(1, Number(storedVolume)));
      }
      const theme = localStorage.getItem(STORAGE_SOUND_THEME);
      if (isSoundTheme(theme)) this.theme = theme;
      const storedCategories = localStorage.getItem(STORAGE_SOUND_CATEGORIES);
      if (storedCategories) {
        const parsed = JSON.parse(storedCategories) as Record<string, unknown>;
        for (const category of Object.keys(DEFAULT_CATEGORIES) as SoundCategory[]) {
          if (typeof parsed[category] === "boolean") this.categories[category] = parsed[category] as boolean;
        }
      }
    } catch {
      // Storage may be disabled or contain invalid legacy data. Defaults remain usable.
    }
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
      if (this.audioCtx.state === "suspended") void this.audioCtx.resume().catch(() => {});
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public isEnabled() { return this.soundEnabled; }
  public getVolume() { return this.volume; }
  public getTheme() { return this.theme; }
  public isCategoryEnabled(category: SoundCategory) { return this.categories[category]; }

  public isSuspended(): boolean {
    return this.audioCtx !== null && this.audioCtx.state === "suspended";
  }

  public async resumeContext(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === "running";
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    this.store(STORAGE_SOUND_ENABLED, String(enabled));
  }

  public setVolume(volume: number) {
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : this.volume;
    this.store(STORAGE_SOUND_VOLUME, String(this.volume));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.03);
    }
  }

  public setTheme(theme: SoundTheme) {
    this.theme = theme;
    this.store(STORAGE_SOUND_THEME, theme);
  }

  public setCategoryEnabled(category: SoundCategory, enabled: boolean) {
    this.categories[category] = enabled;
    this.store(STORAGE_SOUND_CATEGORIES, JSON.stringify(this.categories));
  }

  private store(key: string, value: string) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key, value); } catch { /* Storage may be blocked. */ }
  }

  private play(event: SoundEvent) {
    if (!this.soundEnabled || this.volume <= 0) return;
    const category: SoundCategory | null = event === "countdown" ? "countdown"
      : event === "victory" ? "victory"
      : event.startsWith("round") ? "round" : null;
    if (category && !this.categories[category]) return;
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    try {
      for (const note of SOUND_PACKS[this.theme].notes[event]) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + note.start;
        const end = start + note.duration;
        oscillator.type = note.waveform;
        oscillator.frequency.setValueAtTime(note.frequency, start);
        if (note.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, end);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(note.amplitude, start + Math.min(0.02, note.duration / 4));
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(start);
        oscillator.stop(end + 0.01);
      }
    } catch {
      // Browsers can reject playback before a user gesture; controls stay responsive.
    }
  }

  public playPreviewChime() { this.play("preview"); }
  public playCountdownTick() { this.play("countdown"); }
  public playRoundChime(correct: boolean) { this.play(correct ? "roundCorrect" : "roundIncorrect"); }
  public playVictoryFanfare() { this.play("victory"); }
}

export const audioManager = AudioManager.getInstance();
