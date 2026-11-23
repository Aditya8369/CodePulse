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

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Flame, Rocket, Zap, Sparkles, Activity, ShieldCheck, Gauge } from "lucide-react";
export type ReactionEmoji = "🔥" | "🚀" | "💡" | "🤯" | "⚡" | "💀" | "🏆" | "💎";
export const DEFAULT_REACTIONS: ReactionEmoji[] = ["🔥", "🚀", "💡", "🤯", "⚡", "💀", "🏆", "💎"];
  battleId: string;
  maxParticles?: number; // Up to 10,000
  enableAudio?: boolean;
  showControls?: boolean;
  onEmitReaction?: (emoji: ReactionEmoji) => void;
  onFpsChange?: (fps: number) => void;
export const SpectatorReactionStorm: React.FC<SpectatorReactionStormProps> = ({
  battleId,
  maxParticles = 10000,
  enableAudio = false,
  showControls = true,
  className = "",
  onEmitReaction,
  onFpsChange,
}) => {
  const [fps, setFps] = useState<number>(60);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [isStormActive, setIsStormActive] = useState<boolean>(false);
  // Pre-allocated particle buffer pools (Zero GC during particle storms)
  const capacity = Math.min(maxParticles, 10000);
  const particleCountRef = useRef<number>(0);
  const posXRef = useRef<Float32Array>(new Float32Array(capacity));
  const posYRef = useRef<Float32Array>(new Float32Array(capacity));
  const velXRef = useRef<Float32Array>(new Float32Array(capacity));
  const velYRef = useRef<Float32Array>(new Float32Array(capacity));
  const scaleRef = useRef<Float32Array>(new Float32Array(capacity));
  const alphaRef = useRef<Float32Array>(new Float32Array(capacity));
  const lifeRef = useRef<Float32Array>(new Float32Array(capacity));
  const maxLifeRef = useRef<Float32Array>(new Float32Array(capacity));
  const emojiIdxRef = useRef<Uint8Array>(new Uint8Array(capacity));
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  // Spawn single particle into buffer
  const spawnParticle = useCallback(
    (emojiIdx: number, startX?: number, startY?: number, isMega = false) => {
      const idx = particleCountRef.current;
      if (idx >= capacity) return;
      const width = canvas ? canvas.width : 800;
      const height = canvas ? canvas.height : 600;
      posXRef.current[idx] = startX ?? width * 0.1 + Math.random() * width * 0.8;
      posYRef.current[idx] = startY ?? height + Math.random() * 20;
      const baseSpeed = isMega ? 8.0 : 4.5;
      velXRef.current[idx] = (Math.random() - 0.5) * (isMega ? 5.0 : 2.5);
      velYRef.current[idx] = -(Math.random() * baseSpeed + 3.0);
      scaleRef.current[idx] = isMega ? Math.random() * 20 + 28 : Math.random() * 14 + 18;
      alphaRef.current[idx] = 1.0;
      const duration = Math.random() * 1200 + 1000;
      lifeRef.current[idx] = duration;
      maxLifeRef.current[idx] = duration;
      emojiIdxRef.current[idx] = emojiIdx % DEFAULT_REACTIONS.length;
      particleCountRef.current++;
    [capacity],
  // Spawns a burst of reaction particles
  const triggerBurst = useCallback(
    (count: number, emoji: ReactionEmoji = "🔥") => {
      const emojiIdx = DEFAULT_REACTIONS.indexOf(emoji);
      const safeIdx = emojiIdx >= 0 ? emojiIdx : 0;
      const burstSize = Math.min(count, capacity - particleCountRef.current);
      for (let i = 0; i < burstSize; i++) {
        spawnParticle(safeIdx, undefined, undefined, count > 1000);
      setIsStormActive(true);
      onEmitReaction?.(emoji);
    [capacity, onEmitReaction, spawnParticle],
  // Main Render Loop
    // Handle high DPI scaling
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const updateSize = () => {
      if (containerRef.current && canvas) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = Math.max(rect.width * dpr, 300);
        canvas.height = Math.max(rect.height * dpr, 200);
    updateSize();
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

    const renderLoop = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      // FPS calculation
      frameCountRef.current++;
      if (now - fpsTimerRef.current >= 500) {
        const calculatedFps = Math.round((frameCountRef.current * 1000) / (now - fpsTimerRef.current));
        setFps(calculatedFps);
        onFpsChange?.(calculatedFps);
        setActiveCount(particleCountRef.current);
        frameCountRef.current = 0;
        fpsTimerRef.current = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let count = particleCountRef.current;
      let writeIdx = 0;
      // High-performance typed-array loop
      for (let i = 0; i < count; i++) {
        lifeRef.current[i] -= delta * 1000;
        if (lifeRef.current[i] > 0) {
          // Physics step
          posXRef.current[i] += velXRef.current[i];
          posYRef.current[i] += velYRef.current[i];
          // Gentle sinusoidal horizontal oscillation
          posXRef.current[i] += Math.sin(now * 0.005 + i) * 0.8;
          // Alpha fade curve
          const progress = lifeRef.current[i] / maxLifeRef.current[i];
          alphaRef.current[i] = Math.max(0, Math.min(1, progress * 1.5));
          // Draw emoji particle
          const size = scaleRef.current[i];
          const alpha = alphaRef.current[i];
          const emoji = DEFAULT_REACTIONS[emojiIdxRef.current[i]];
          ctx.globalAlpha = alpha;
          ctx.font = `${size}px sans-serif`;
          ctx.fillText(emoji, posXRef.current[i], posYRef.current[i]);
          // Compact active particles in-place
          if (writeIdx !== i) {
            posXRef.current[writeIdx] = posXRef.current[i];
            posYRef.current[writeIdx] = posYRef.current[i];
            velXRef.current[writeIdx] = velXRef.current[i];
            velYRef.current[writeIdx] = velYRef.current[i];
            scaleRef.current[writeIdx] = scaleRef.current[i];
            alphaRef.current[writeIdx] = alphaRef.current[i];
            lifeRef.current[writeIdx] = lifeRef.current[i];
            maxLifeRef.current[writeIdx] = maxLifeRef.current[i];
            emojiIdxRef.current[writeIdx] = emojiIdxRef.current[i];
          }
          writeIdx++;
      particleCountRef.current = writeIdx;
      if (writeIdx === 0 && isStormActive) {
        setIsStormActive(false);
      animFrameRef.current = requestAnimationFrame(renderLoop);
    animFrameRef.current = requestAnimationFrame(renderLoop);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
  }, [isStormActive, onFpsChange]);

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

      className={`relative w-full h-full min-h-[350px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl ${className}`}
      data-testid="reaction-storm-container"
      {/* Background Ambience Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-zinc-950/40 to-zinc-950 pointer-events-none" />
      {/* Particle Canvas Layer */}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        data-testid="reaction-storm-canvas"
      {/* Top Diagnostics HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-700/60 text-xs font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-zinc-400">FPS:</span>
          <span
            className={`font-semibold ${
              fps >= 55 ? "text-emerald-400" : fps >= 40 ? "text-amber-400" : "text-rose-400"
            }`}
            data-testid="fps-counter"
            {fps}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Active:</span>
          <span className="font-semibold text-cyan-400" data-testid="particle-counter">
            {activeCount.toLocaleString()} / {capacity.toLocaleString()}
        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-700/60 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-300 font-medium">GPU Instanced Single Draw Call</span>
      {/* Spectator Interactive Reaction Dock */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-30">
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-900/90 backdrop-blur-lg border border-zinc-700 shadow-xl">
            {DEFAULT_REACTIONS.map((emoji) => (
                key={emoji}
                onClick={() => triggerBurst(25, emoji)}
                className="w-10 h-10 flex items-center justify-center text-lg rounded-full hover:bg-zinc-800 hover:scale-125 active:scale-95 transition-transform duration-150 cursor-pointer"
                title={`Send ${emoji} reaction`}
                data-testid={`react-btn-${emoji}`}
                {emoji}
          {/* Quick Storm Presets */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => triggerBurst(500, "🔥")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              500 Firestorm
            </button>
              onClick={() => triggerBurst(2000, "🚀")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer"
              <Rocket className="w-3.5 h-3.5 text-cyan-400" />
              2,000 Hyperspace
              onClick={() => triggerBurst(5000, "⚡")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors cursor-pointer"
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              5,000 Mega Storm
};
