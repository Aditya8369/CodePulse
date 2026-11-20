"use client";

import React, { useRef, useState } from "react";
import { Volume2, VolumeX, Sliders } from "lucide-react";
import {
  SfxEventId,
  SfxSynthesizer,
  SOUND_PACK_PROFILES,
  SoundPackId,
} from "../audio/sfx-synthesizer";

export interface SoundSettingsProps {
  synthesizer?: SfxSynthesizer;
  onConfigChange?: (config: ReturnType<SfxSynthesizer["getConfig"]>) => void;
}

export const SoundSettings: React.FC<SoundSettingsProps> = ({
  synthesizer,
  onConfigChange,
}) => {
  const synthRef = useRef<SfxSynthesizer>(synthesizer ?? new SfxSynthesizer());
  const [config, setConfig] = useState(synthRef.current.getConfig());

  const syncConfig = () => {
    const next = synthRef.current.getConfig();
    setConfig(next);
    onConfigChange?.(next);
  };

  const handlePackSelect = async (packId: SoundPackId) => {
    await synthRef.current.unlockFromUserGesture();
    synthRef.current.setPack(packId);
    synthRef.current.playTestPassed();
    syncConfig();
  };

  const handleMasterVolume = async (val: number) => {
    await synthRef.current.unlockFromUserGesture();
    synthRef.current.setMasterVolume(val);
    syncConfig();
  };

  const handleSfxVolume = async (val: number) => {
    await synthRef.current.unlockFromUserGesture();
    synthRef.current.setSfxVolume(val);
    syncConfig();
  };

  const handleToggleMute = async () => {
    await synthRef.current.unlockFromUserGesture();
    synthRef.current.setMuted(!config.isMuted);
    syncConfig();
  };

  const handlePreviewEffect = async (effect: SfxEventId) => {
    await synthRef.current.unlockFromUserGesture();
    if (effect === "keystroke") synthRef.current.playKeystroke();
    else if (effect === "compile-error") synthRef.current.playCompileError();
    else if (effect === "test-passed") synthRef.current.playTestPassed();
    else if (effect === "combo-streak") synthRef.current.playComboStreak(4);
    else if (effect === "victory-fanfare") synthRef.current.playVictoryFanfare();
    syncConfig();
  };

  return (
    <section
      aria-label="Procedural Sound Effects Settings"
      className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold">
            Web Audio SFX Synthesizer & Sound Packs
          </h2>
        </div>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
            config.isMuted
              ? "bg-rose-600 text-white"
              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          }`}
        >
          {config.isMuted ? (
            <>
              <VolumeX className="h-3.5 w-3.5" /> Master Muted
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> Master Active
            </>
          )}
        </button>
      </div>

      {/* Sound Pack Selector */}
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(SOUND_PACK_PROFILES) as SoundPackId[]).map((packId) => {
          const pack = SOUND_PACK_PROFILES[packId];
          const selected = config.pack === packId;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => handlePackSelect(pack.id)}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700"
              }`}
            >
              <span className="text-xs font-semibold text-white">
                {pack.label}
              </span>
              <span className="mt-0.5 text-[11px] text-zinc-400">
                {pack.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Independent Volume Sliders */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-300">
            <label htmlFor="master-volume-slider">Master Volume</label>
            <span>{Math.round(config.masterVolume * 100)}%</span>
          </div>
          <input
            id="master-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.masterVolume}
            onChange={(e) => handleMasterVolume(parseFloat(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-300">
            <label htmlFor="sfx-volume-slider">SFX Volume</label>
            <span>{Math.round(config.sfxVolume * 100)}%</span>
          </div>
          <input
            id="sfx-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.sfxVolume}
            onChange={(e) => handleSfxVolume(parseFloat(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
      </div>

      {/* Preview Triggers */}
      <div className="flex flex-wrap gap-2 pt-1">
        {(
          [
            ["keystroke", "Keystroke"],
            ["compile-error", "Compile Error"],
            ["test-passed", "Test Passed"],
            ["combo-streak", "Combo Siren"],
            ["victory-fanfare", "Victory Fanfare"],
          ] as Array<[SfxEventId, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => handlePreviewEffect(id)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Preview {label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default SoundSettings;
