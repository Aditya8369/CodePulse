"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { audioManager } from "@/lib/audio-manager";
import { SOUND_PACKS, type SoundCategory, type SoundTheme } from "@/lib/sounds";

const categories: { id: SoundCategory; label: string }[] = [
  { id: "countdown", label: "Countdown ticking" },
  { id: "round", label: "Round result chimes" },
  { id: "victory", label: "Victory fanfare and confetti chime" },
];

export function SoundSettingsCard() {
  const [enabled, setEnabled] = useState(() => audioManager.isEnabled());
  const [volume, setVolume] = useState(() => Math.round(audioManager.getVolume() * 100));
  const [theme, setTheme] = useState<SoundTheme>(() => audioManager.getTheme());
  const [activeCategories, setActiveCategories] = useState<Record<SoundCategory, boolean>>(() => ({
    countdown: audioManager.isCategoryEnabled("countdown"),
    round: audioManager.isCategoryEnabled("round"),
    victory: audioManager.isCategoryEnabled("victory"),
  }));

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5" aria-label="Sound effects settings">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            {enabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            Battle sound effects
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Choose a theme and control the sounds you hear.</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => {
            setEnabled(value);
            audioManager.setEnabled(value);
            if (value) audioManager.playPreviewChime();
          }}
          aria-label="Enable battle sound effects"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="sound-theme" className="text-xs font-medium text-slate-300">Sound theme</label>
          <select
            id="sound-theme"
            value={theme}
            onChange={(event) => {
              const next = event.target.value as SoundTheme;
              setTheme(next);
              audioManager.setTheme(next);
              audioManager.playPreviewChime();
            }}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#13182a] px-3 py-2 text-sm text-white"
          >
            {(Object.keys(SOUND_PACKS) as SoundTheme[]).map((id) => <option key={id} value={id}>{SOUND_PACKS[id].label}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => audioManager.playPreviewChime()}
          disabled={!enabled || volume === 0}
          className="rounded-lg border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Preview
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{SOUND_PACKS[theme].description}</p>

      <div className="mt-5">
        <label htmlFor="sound-volume-slider" className="flex justify-between text-xs font-medium text-slate-300">
          Master volume <span className="tabular-nums text-emerald-400">{volume}%</span>
        </label>
        <input
          id="sound-volume-slider"
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => {
            const next = Number(event.target.value);
            setVolume(next);
            audioManager.setVolume(next / 100);
          }}
          className="mt-3 w-full cursor-pointer accent-primary"
        />
      </div>

      <fieldset className="mt-5 space-y-2">
        <legend className="mb-2 text-xs font-medium text-slate-300">Play sounds for</legend>
        {categories.map(({ id, label }) => (
          <label key={id} className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={activeCategories[id]}
              onChange={(event) => {
                const next = event.target.checked;
                setActiveCategories((previous) => ({ ...previous, [id]: next }));
                audioManager.setCategoryEnabled(id, next);
              }}
              className="accent-primary"
            />
            {label}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
