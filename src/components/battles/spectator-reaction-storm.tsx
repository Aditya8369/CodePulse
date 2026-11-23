"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame,
  Zap,
  Rocket,
  Skull,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Gauge,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ReactionEmoji = "🔥" | "⚡" | "🚀" | "💀" | "🤯" | "🏆";

export interface EmojiConfig {
  emoji: ReactionEmoji;
  label: string;
  key: string;
  color: string;
  points: number;
}

export const EMOJI_HOTBAR: EmojiConfig[] = [
  { emoji: "🔥", label: "Fire", key: "1", color: "#f97316", points: 10 },
  { emoji: "⚡", label: "Thunder", key: "2", color: "#eab308", points: 15 },
  { emoji: "🚀", label: "Rocket", key: "3", color: "#06b6d4", points: 20 },
  { emoji: "💀", label: "Dead Code", key: "4", color: "#a855f7", points: 12 },
  { emoji: "🤯", label: "Mindblown", key: "5", color: "#ec4899", points: 25 },
  { emoji: "🏆", label: "Champion", key: "6", color: "#10b981", points: 30 },
];

export interface BubbleParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  emoji: ReactionEmoji;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  buoyancy: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  wobbleOffset: number;
  isBurst: boolean;
}

export interface SpectatorReactionStormProps {
  battleId?: string;
  initialHypeScore?: number;
  onSendReaction?: (emoji: ReactionEmoji, combo: number) => void;
  onStormTrigger?: (intensity: number) => void;
  allowKeyboardShortcuts?: boolean;
  className?: string;
}

export function SpectatorReactionStorm({
  battleId = "live-battle-alpha",
  initialHypeScore = 120,
  onSendReaction,
  onStormTrigger,
  allowKeyboardShortcuts = true,
  className,
}: SpectatorReactionStormProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hypeScore, setHypeScore] = useState(initialHypeScore);
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1.0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [activeStormLevel, setActiveStormLevel] = useState<"CALM" | "HEATED" | "SUPERCHARGED" | "TSUNAMI">("CALM");

  const particlesRef = useRef<BubbleParticle[]>([]);
  const nextParticleIdRef = useRef(1);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio Synth sound trigger
  const playPopTone = useCallback(
    (freq = 440) => {
      if (!isAudioEnabled || typeof window === "undefined") return;
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      } catch {
        // Fallback gracefully if Web Audio is restricted
      }
    },
    [isAudioEnabled]
  );

  // Spawn bubble on canvas
  const spawnBubble = useCallback(
    (emoji: ReactionEmoji, originX?: number, originY?: number, isBurstSpread = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width || 600;
      const height = canvas.height || 400;

      const cfg = EMOJI_HOTBAR.find((e) => e.emoji === emoji) || EMOJI_HOTBAR[0];
      const startX = originX !== undefined ? originX : Math.random() * (width - 80) + 40;
      const startY = originY !== undefined ? originY : height + 10;

      const particle: BubbleParticle = {
        id: nextParticleIdRef.current++,
        x: startX,
        y: startY,
        vx: isBurstSpread ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 1.5,
        vy: isBurstSpread ? -(Math.random() * 4 + 3) : -(Math.random() * 2 + 2.5),
        radius: Math.random() * 6 + 22,
        emoji,
        color: cfg.color,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 80 + 160,
        buoyancy: Math.random() * 0.05 + 0.08,
        wobbleSpeed: Math.random() * 0.05 + 0.03,
        wobbleAmp: Math.random() * 25 + 15,
        wobbleOffset: Math.random() * Math.PI * 2,
        isBurst: isBurstSpread,
      };

      particlesRef.current.push(particle);
      // Cap particles for performance
      if (particlesRef.current.length > 120) {
        particlesRef.current.shift();
      }
    },
    []
  );

  // Trigger Reaction Action
  const triggerReaction = useCallback(
    (emoji: ReactionEmoji) => {
      const cfg = EMOJI_HOTBAR.find((e) => e.emoji === emoji) || EMOJI_HOTBAR[0];

      // Spawn 3-5 bubbles per click
      const burstCount = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < burstCount; i++) {
        spawnBubble(emoji);
      }

      playPopTone(350 + Math.random() * 300);

      // Increment Combo and Multiplier
      setComboCount((prev) => {
        const next = prev + 1;
        const newMultiplier = Math.min(4.0, +(1.0 + Math.floor(next / 5) * 0.25).toFixed(2));
        setComboMultiplier(newMultiplier);

        const gainedHype = Math.round(cfg.points * newMultiplier);
        setHypeScore((h) => {
          const updated = h + gainedHype;
          if (updated > 600 && activeStormLevel !== "TSUNAMI") {
            setActiveStormLevel("TSUNAMI");
            toast.success("🌊 HYPE TSUNAMI TRIGGERED!", {
              description: "Spectator storm intensity reached maximum overdrive!",
            });
            onStormTrigger?.(4);
          } else if (updated > 350 && activeStormLevel === "CALM") {
            setActiveStormLevel("SUPERCHARGED");
            onStormTrigger?.(3);
          }
          return updated;
        });

        return next;
      });

      // Reset combo decay timer
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        setComboCount(0);
        setComboMultiplier(1.0);
        setActiveStormLevel("CALM");
      }, 3500);

      onSendReaction?.(emoji, comboCount + 1);
    },
    [spawnBubble, playPopTone, onSendReaction, onStormTrigger, comboCount, activeStormLevel]
  );

  // Keyboard reaction triggers (1-6)
  useEffect(() => {
    if (!allowKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const match = EMOJI_HOTBAR.find((cfg) => cfg.key === e.key);
      if (match) {
        e.preventDefault();
        triggerReaction(match.emoji);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowKeyboardShortcuts, triggerReaction]);

  // Canvas Physics Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const remainingParticles: BubbleParticle[] = [];

      for (const p of particlesRef.current) {
        p.life++;
        p.y += p.vy;
        p.x += Math.sin(p.life * p.wobbleSpeed + p.wobbleOffset) * (p.wobbleAmp * 0.05) + p.vx;
        p.vy -= p.buoyancy * 0.1; // accelerate upwards

        // Fade out near top
        if (p.y < height * 0.25) {
          p.alpha = Math.max(0, p.y / (height * 0.25));
        }

        if (p.life < p.maxLife && p.y > -50 && p.alpha > 0.05) {
          remainingParticles.push(p);

          ctx.save();
          ctx.globalAlpha = p.alpha;

          // Outer glowing bubble ring
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}22`;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = `${p.color}88`;
          ctx.stroke();

          // Bubble highlight glare
          ctx.beginPath();
          ctx.arc(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fill();

          // Emoji content
          ctx.font = `${Math.round(p.radius * 1.1)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.emoji, p.x, p.y + 1);

          ctx.restore();
        }
      }

      particlesRef.current = remainingParticles;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Handle canvas resize on mount & window resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        canvas.width = container.clientWidth || 600;
        canvas.height = container.clientHeight || 400;
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="spectator-reaction-storm-container"
      className={cn(
        "relative w-full h-[460px] rounded-3xl border border-white/10 bg-[#090D18]/95 overflow-hidden flex flex-col justify-between shadow-2xl backdrop-blur-2xl text-slate-100",
        className
      )}
    >
      {/* Background Interactive Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="spectator-physics-canvas"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Top Header / Storm Telemetry HUD */}
      <div className="relative z-10 p-4 flex items-center justify-between border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              data-testid="storm-status-badge"
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider border shadow-sm flex items-center gap-1.5",
                activeStormLevel === "TSUNAMI"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                  : activeStormLevel === "SUPERCHARGED"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              {activeStormLevel === "TSUNAMI" ? "🌊 HYPE TSUNAMI" : "SPECTATOR STORM"}
            </span>

            <span className="text-[11px] font-mono text-slate-400">Battle #{battleId}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Combo Multiplier Meter */}
          {comboCount > 0 && (
            <motion.div
              data-testid="combo-multiplier-badge"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-xs font-black font-mono flex items-center gap-1.5 shadow-lg"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{comboCount}x COMBO ({comboMultiplier}x pts)</span>
            </motion.div>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            data-testid="toggle-sound-btn"
            onClick={() => setIsAudioEnabled((prev) => !prev)}
            aria-label={isAudioEnabled ? "Mute audio reactions" : "Enable audio reactions"}
            className="p-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Middle Interactive Zone Watermark */}
      <div className="relative z-0 flex-1 flex flex-col items-center justify-center pointer-events-none select-none opacity-20">
        <Sparkles className="w-16 h-16 text-indigo-400 animate-spin" style={{ animationDuration: "25s" }} />
        <span className="font-mono text-xs uppercase tracking-widest text-slate-400 mt-2">
          Spectator Reaction Storm Physics
        </span>
      </div>

      {/* Bottom Spectator Hotbar */}
      <div className="relative z-10 p-4 border-t border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Total Hype Points Score */}
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-slate-300">Total Hype:</span>
            <span data-testid="total-hype-score" className="font-mono font-black text-amber-300 text-sm">
              {hypeScore.toLocaleString()} pts
            </span>
          </div>

          {/* Emoji Reaction Buttons */}
          <div className="flex items-center gap-2">
            {EMOJI_HOTBAR.map((cfg) => (
              <button
                key={cfg.key}
                type="button"
                data-testid={`emoji-btn-${cfg.key}`}
                onClick={() => triggerReaction(cfg.emoji)}
                className="group relative flex flex-col items-center justify-center w-11 h-12 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] active:scale-90 transition-all shadow-md cursor-pointer hover:border-white/20"
              >
                <span className="text-xl group-hover:scale-125 transition-transform duration-150">
                  {cfg.emoji}
                </span>
                <span className="text-[9px] font-mono text-slate-400 -mt-0.5">[{cfg.key}]</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
