"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  VolumeX,
  Play,
  Check,
  Sparkles,
  Keyboard,
  CheckCircle2,
  XCircle,
  Trophy,
  Sliders,
  Music,
  Radio,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SoundPackId,
  SfxEventId,
  SOUND_PACK_PROFILES,
  SfxPackProfile,
} from "./sfx-synthesizer";

export interface SoundPackDockProps {
  initialPack?: SoundPackId;
  onPackChange?: (packId: SoundPackId) => void;
  className?: string;
}

export function SoundPackDock({
  initialPack = "retro-8bit",
  onPackChange,
  className,
}: SoundPackDockProps) {
  const [activePackId, setActivePackId] = useState<SoundPackId>(initialPack);
  const [volume, setVolume] = useState<number>(75);
  const [isMuted, setIsMuted] = useState(false);
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  const packs = useMemo(() => Object.values(SOUND_PACK_PROFILES), []);

  // Web Audio Synth playback for instant auditioning
  const playSampleSound = useCallback(
    (packId: SoundPackId, event: SfxEventId) => {
      if (isMuted || typeof window === "undefined") return;

      const profile = SOUND_PACK_PROFILES[packId];
      if (!profile) return;

      setPlayingSample(`${packId}-${event}`);
      setTimeout(() => setPlayingSample(null), 350);

      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        let freq = profile.keystrokeFreqHz || 440;
        let wave: OscillatorType = profile.keystrokeWave || "sine";
        let duration = 0.15;

        if (event === "test-passed") {
          freq = profile.keystrokeFreqHz * 1.8;
          wave = profile.chimeWave || "sine";
          duration = 0.25;
        } else if (event === "compile-error") {
          freq = profile.keystrokeFreqHz * 0.6;
          wave = profile.errorWave || "sawtooth";
          duration = 0.3;
        } else if (event === "victory-fanfare") {
          freq = profile.keystrokeFreqHz * 2.2;
          wave = profile.chimeWave || "triangle";
          duration = 0.45;
        }

        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const currentVol = (volume / 100) * 0.12;
        gain.gain.setValueAtTime(currentVol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch {
        // Fallback gracefully if Web Audio is restricted
      }
    },
    [volume, isMuted]
  );

  const handleSelectPack = (packId: SoundPackId) => {
    setActivePackId(packId);
    onPackChange?.(packId);
    playSampleSound(packId, "test-passed");
    const label = SOUND_PACK_PROFILES[packId]?.label || packId;
    toast.success(`Sound Pack switched to "${label}"!`);
  };

  return (
    <div
      data-testid="sound-pack-dock-container"
      className={cn(
        "w-full rounded-3xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-2xl p-6 shadow-2xl text-slate-100 flex flex-col gap-6",
        className
      )}
    >
      {/* Dock Header & Global Audio HUD */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
              AUDIO CUSTOMIZATION
            </span>
            <span className="text-xs text-slate-400 font-mono">Web Audio API Synth</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
            <Headphones className="w-6 h-6 text-indigo-400" />
            Sound Pack Switcher & Audition Dock
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Switch your battle keystrokes, compiler chimes, and victory fanfares in real-time.
          </p>
        </div>

        {/* Global Volume HUD */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/10">
          <button
            type="button"
            data-testid="toggle-mute-btn"
            onClick={() => setIsMuted((m) => !m)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              aria-label="Master SFX Volume Slider"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-24 accent-indigo-500 h-1.5 rounded-lg bg-white/10 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-slate-300 w-8 text-right">
              {isMuted ? "0%" : `${volume}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Sound Packs Grid */}
      <div data-testid="sound-packs-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => {
          const isSelected = activePackId === pack.id;

          return (
            <motion.div
              key={pack.id}
              data-testid={`sound-pack-card-${pack.id}`}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              onClick={() => handleSelectPack(pack.id)}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-lg relative",
                isSelected
                  ? "bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/40"
                  : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400">
                    {pack.keystrokeWave} wave
                  </span>
                  {isSelected && (
                    <span
                      data-testid={`active-badge-${pack.id}`}
                      className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold flex items-center gap-1"
                    >
                      <Check className="w-2.5 h-2.5" /> ACTIVE
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-white">{pack.label}</h3>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {pack.description}
                </p>
              </div>

              {/* Instant Audio Audition Sample Bar */}
              <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Audition Samples
                </span>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    data-testid={`sample-keystroke-${pack.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleSound(pack.id, "keystroke");
                    }}
                    title="Audition Keystroke Click"
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/5 text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[9px] font-mono">Key</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`sample-passed-${pack.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleSound(pack.id, "test-passed");
                    }}
                    title="Audition Test Passed Chime"
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/5 text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-mono">Pass</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`sample-error-${pack.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleSound(pack.id, "compile-error");
                    }}
                    title="Audition Compile Error Chime"
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/5 text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[9px] font-mono">Err</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`sample-victory-${pack.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playSampleSound(pack.id, "victory-fanfare");
                    }}
                    title="Audition Victory Fanfare"
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/5 text-slate-300 hover:text-white transition-all flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[9px] font-mono">Win</span>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
