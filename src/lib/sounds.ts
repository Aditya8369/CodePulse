export type SoundTheme = "retro" | "cyber" | "minimal";
export type SoundEvent = "preview" | "countdown" | "roundCorrect" | "roundIncorrect" | "victory";
export type SoundCategory = "countdown" | "round" | "victory";

export interface SoundNote {
  frequency: number;
  endFrequency?: number;
  start: number;
  duration: number;
  amplitude: number;
  waveform: OscillatorType;
}

export interface SoundPack {
  label: string;
  description: string;
  notes: Record<SoundEvent, SoundNote[]>;
}

const notes = (
  frequencies: number[], waveform: OscillatorType, amplitude: number, gap = 0.09,
): SoundNote[] => frequencies.map((frequency, index) => ({
  frequency, start: index * gap, duration: 0.18, amplitude, waveform,
}));

export const SOUND_PACKS: Record<SoundTheme, SoundPack> = {
  retro: {
    label: "Retro 8-Bit",
    description: "Bright arcade blips and a chiptune victory fanfare.",
    notes: {
      preview: notes([523.25, 659.25, 783.99], "square", 0.11),
      countdown: [{ frequency: 880, start: 0, duration: 0.08, amplitude: 0.1, waveform: "square" }],
      roundCorrect: notes([987.77, 1318.51], "square", 0.12, 0.06),
      roundIncorrect: notes([493.88, 329.63], "square", 0.08, 0.07),
      victory: notes([523.25, 659.25, 783.99, 1046.5], "square", 0.13, 0.11),
    },
  },
  cyber: {
    label: "Cyber Synth",
    description: "Digital sweeps, synth chords, and a bass-led finale.",
    notes: {
      preview: notes([220, 440, 659.25], "sawtooth", 0.08),
      countdown: [{ frequency: 1200, endFrequency: 420, start: 0, duration: 0.12, amplitude: 0.08, waveform: "sawtooth" }],
      roundCorrect: notes([659.25, 987.77], "triangle", 0.12, 0.04),
      roundIncorrect: notes([440, 220], "sawtooth", 0.06, 0.07),
      victory: [
        { frequency: 110, start: 0, duration: 0.48, amplitude: 0.12, waveform: "sine" },
        ...notes([440, 554.37, 659.25, 880], "sawtooth", 0.08, 0.11),
      ],
    },
  },
  minimal: {
    label: "Minimal",
    description: "Quiet clicks and soft harp-like chimes.",
    notes: {
      preview: notes([523.25, 783.99], "sine", 0.06, 0.12),
      countdown: [{ frequency: 320, start: 0, duration: 0.04, amplitude: 0.04, waveform: "sine" }],
      roundCorrect: notes([659.25, 880], "sine", 0.06, 0.08),
      roundIncorrect: [{ frequency: 392, start: 0, duration: 0.12, amplitude: 0.04, waveform: "sine" }],
      victory: notes([523.25, 659.25, 783.99], "sine", 0.07, 0.16),
    },
  },
};

export function isSoundTheme(value: string | null): value is SoundTheme {
  return value !== null && Object.prototype.hasOwnProperty.call(SOUND_PACKS, value);
}
