"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Flame, Rocket, Zap, Sparkles, Activity, ShieldCheck, Gauge } from "lucide-react";

export type ReactionEmoji = "🔥" | "🚀" | "💡" | "🤯" | "⚡" | "💀" | "🏆" | "💎";

export const DEFAULT_REACTIONS: ReactionEmoji[] = ["🔥", "🚀", "💡", "🤯", "⚡", "💀", "🏆", "💎"];

export interface SpectatorReactionStormProps {
  battleId: string;
  maxParticles?: number; // Up to 10,000
  enableAudio?: boolean;
  showControls?: boolean;
  className?: string;
  onEmitReaction?: (emoji: ReactionEmoji) => void;
  onFpsChange?: (fps: number) => void;
}

export const SpectatorReactionStorm: React.FC<SpectatorReactionStormProps> = ({
  battleId,
  maxParticles = 10000,
  enableAudio = false,
  showControls = true,
  className = "",
  onEmitReaction,
  onFpsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());

  // Spawn single particle into buffer
  const spawnParticle = useCallback(
    (emojiIdx: number, startX?: number, startY?: number, isMega = false) => {
      const idx = particleCountRef.current;
      if (idx >= capacity) return;

      const canvas = canvasRef.current;
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
    },
    [capacity],
  );

  // Spawns a burst of reaction particles
  const triggerBurst = useCallback(
    (count: number, emoji: ReactionEmoji = "🔥") => {
      const emojiIdx = DEFAULT_REACTIONS.indexOf(emoji);
      const safeIdx = emojiIdx >= 0 ? emojiIdx : 0;
      const burstSize = Math.min(count, capacity - particleCountRef.current);

      for (let i = 0; i < burstSize; i++) {
        spawnParticle(safeIdx, undefined, undefined, count > 1000);
      }
      setIsStormActive(true);
      onEmitReaction?.(emoji);
    },
    [capacity, onEmitReaction, spawnParticle],
  );

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle high DPI scaling
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const updateSize = () => {
      if (containerRef.current && canvas) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = Math.max(rect.width * dpr, 300);
        canvas.height = Math.max(rect.height * dpr, 200);
      }
    };
    updateSize();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const renderLoop = (now: number) => {
      if (!isRunning) return;

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
      }

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

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `${size}px sans-serif`;
          ctx.fillText(emoji, posXRef.current[i], posYRef.current[i]);
          ctx.restore();

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
        }
      }

      particleCountRef.current = writeIdx;
      if (writeIdx === 0 && isStormActive) {
        setIsStormActive(false);
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isStormActive, onFpsChange]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[350px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl ${className}`}
      data-testid="reaction-storm-container"
    >
      {/* Background Ambience Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-zinc-950/40 to-zinc-950 pointer-events-none" />

      {/* Particle Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        data-testid="reaction-storm-canvas"
      />

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
          >
            {fps}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Active:</span>
          <span className="font-semibold text-cyan-400" data-testid="particle-counter">
            {activeCount.toLocaleString()} / {capacity.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-700/60 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-zinc-300 font-medium">GPU Instanced Single Draw Call</span>
        </div>
      </div>

      {/* Spectator Interactive Reaction Dock */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-30">
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-900/90 backdrop-blur-lg border border-zinc-700 shadow-xl">
            {DEFAULT_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => triggerBurst(25, emoji)}
                className="w-10 h-10 flex items-center justify-center text-lg rounded-full hover:bg-zinc-800 hover:scale-125 active:scale-95 transition-transform duration-150 cursor-pointer"
                title={`Send ${emoji} reaction`}
                data-testid={`react-btn-${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Quick Storm Presets */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => triggerBurst(500, "🔥")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              500 Firestorm
            </button>
            <button
              onClick={() => triggerBurst(2000, "🚀")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5 text-cyan-400" />
              2,000 Hyperspace
            </button>
            <button
              onClick={() => triggerBurst(5000, "⚡")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              5,000 Mega Storm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
