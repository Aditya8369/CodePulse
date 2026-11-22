"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Volume2, VolumeX, Sparkles, Activity, Radio, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

export type CasterStyle = "HYPE_CASTER" | "TECHNICAL_ANALYST";
export type CasterEmotion = "Hype" | "Suspense" | "Analytical" | "Climax";

export interface IncomingAudioCommentaryChunk {
  streamId: string;
  battleId: string;
  lineId: string;
  chunkIndex: number;
  totalChunks: number;
  isFinal: boolean;
  mimeType: string;
  sampleRate: number;
  audioBase64: string;
  transcript: string;
  emotion: CasterEmotion;
  style: CasterStyle;
  latencyMs: number;
}

export interface AudioCasterPlayerProps {
  battleId: string;
  initialStyle?: CasterStyle;
  incomingChunk?: IncomingAudioCommentaryChunk | null;
  onStyleChange?: (style: CasterStyle) => void;
  className?: string;
}

const EMOTION_BADGE_STYLES: Record<CasterEmotion, string> = {
  Hype: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Suspense: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  Analytical: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  Climax: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
};

const EMOTION_WAVE_COLORS: Record<CasterEmotion, [string, string]> = {
  Hype: ["#f59e0b", "#ef4444"],
  Suspense: ["#f43f5e", "#8b5cf6"],
  Analytical: ["#06b6d4", "#3b82f6"],
  Climax: ["#d946ef", "#ec4899"],
};

/**
 * Live AI Shoutcaster Audio Player for CodePulse Tournament Matches.
 * Buffers incoming WebSocket TTS audio chunks, decodes via Web Audio API,
 * displays real-time emotion-tagged captions and live HTML5 canvas waveform,
 * and lets spectators/players toggle between Energetic Hype Caster and Calm Technical Analyst.
 */
export const AudioCasterPlayer: React.FC<AudioCasterPlayerProps> = ({
  battleId,
  initialStyle = "HYPE_CASTER",
  incomingChunk = null,
  onStyleChange,
  className,
}) => {
  const [style, setStyle] = useState<CasterStyle>(initialStyle);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string>(
    "AI Shoutcaster standing by for live match telemetry..."
  );
  const [currentEmotion, setCurrentEmotion] = useState<CasterEmotion>("Analytical");
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [bufferedStreamCount, setBufferedStreamCount] = useState<number>(0);

  const chunkAssemblyRef = useRef(new Map<string, string[]>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const playAssembledAudio = useCallback(
    async (base64Audio: string) => {
      if (isMuted || typeof window === "undefined") return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        const binary = window.atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        setIsPlaying(true);
        source.onended = () => setIsPlaying(false);
        source.start(0);
      } catch {
        // Ignore headless/autoplay browser restrictions gracefully
        setIsPlaying(false);
      }
    },
    [isMuted]
  );

  useEffect(() => {
    if (!incomingChunk || incomingChunk.battleId !== battleId) return;

    const existing = chunkAssemblyRef.current.get(incomingChunk.streamId) ?? [];
    existing[incomingChunk.chunkIndex] = incomingChunk.audioBase64;
    chunkAssemblyRef.current.set(incomingChunk.streamId, existing);

    setCurrentCaption(incomingChunk.transcript);
    setCurrentEmotion(incomingChunk.emotion);
    setLastLatencyMs(incomingChunk.latencyMs);

    if (incomingChunk.isFinal) {
      const mergedBase64 = existing.join("");
      chunkAssemblyRef.current.delete(incomingChunk.streamId);
      setBufferedStreamCount((c) => c + 1);
      void playAssembledAudio(mergedBase64);
    }
  }, [incomingChunk, battleId, playAssembledAudio]);

  // Live Canvas Waveform Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let step = 0;

    const renderWaveform = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const [c1, c2] = EMOTION_WAVE_COLORS[currentEmotion] || ["#06b6d4", "#3b82f6"];
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, c1);
      gradient.addColorStop(1, c2);

      const barCount = 36;
      const barWidth = width / barCount - 2;
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        // Generate dynamic organic wave amplitude
        const freqMultiplier = currentEmotion === "Hype" ? 2.5 : currentEmotion === "Climax" ? 3.0 : 1.5;
        const activeMultiplier = isPlaying || (incomingChunk && !isMuted) ? 1.0 : 0.25;

        const sinValue = Math.sin((i / barCount) * Math.PI * 4 + step * 0.08);
        const cosValue = Math.cos((i / barCount) * Math.PI * 2 - step * 0.05);
        const amp = Math.abs(sinValue * 0.6 + cosValue * 0.4) * freqMultiplier * activeMultiplier;

        const barHeight = Math.max(4, amp * (height * 0.45));
        const x = i * (barWidth + 2);
        const y = centerY - barHeight / 2;

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, 2) : ctx.rect(x, y, barWidth, barHeight);
        ctx.fill();
      }

      step++;
      animFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentEmotion, isPlaying, incomingChunk, isMuted]);

  const handleSelectStyle = (nextStyle: CasterStyle) => {
    setStyle(nextStyle);
    onStyleChange?.(nextStyle);
  };

  return (
    <section
      aria-label="AI Live Shoutcaster Audio Player"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 text-zinc-100 shadow-xl backdrop-blur-xl",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Mic className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">
                AI Live Shoutcaster
              </span>
              <span
                data-testid="caster-emotion-badge"
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${EMOTION_BADGE_STYLES[currentEmotion]}`}
              >
                {currentEmotion}
              </span>
              {lastLatencyMs !== null && (
                <span className="text-[11px] text-zinc-400 font-mono">
                  {lastLatencyMs}ms TTS
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Commentary Style Toggle"
            className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 text-xs"
          >
            <button
              type="button"
              onClick={() => handleSelectStyle("HYPE_CASTER")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer",
                style === "HYPE_CASTER"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Energetic Hype Caster
            </button>
            <button
              type="button"
              onClick={() => handleSelectStyle("TECHNICAL_ANALYST")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer",
                style === "TECHNICAL_ANALYST"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              Calm Technical Analyst
            </button>
          </div>

          <button
            type="button"
            aria-label={isMuted ? "Unmute Shoutcaster" : "Mute Shoutcaster"}
            onClick={() => setIsMuted((m) => !m)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Live Audio Commentary Waveform Visualizer Canvas */}
      <div
        data-testid="waveform-visualizer-container"
        className="relative h-14 w-full rounded-xl border border-zinc-800/80 bg-black/40 overflow-hidden flex items-center justify-center px-2"
      >
        <canvas
          ref={canvasRef}
          data-testid="waveform-visualizer-canvas"
          width={400}
          height={56}
          className="w-full h-full"
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-zinc-400 bg-black/60 px-2 py-0.5 rounded-full border border-white/5 font-mono">
          <Waves className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>{isMuted ? "Muted" : isPlaying ? "Broadcasting" : "Monitoring"}</span>
        </div>
      </div>

      {/* Real-time Caption Transcript */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-2">
        <p
          data-testid="caster-live-caption"
          className="text-xs leading-relaxed text-zinc-200"
        >
          “{currentCaption}”
        </p>
        <span
          data-testid="caster-stream-count"
          className="shrink-0 text-[11px] font-mono text-zinc-500"
        >
          Streams: {bufferedStreamCount}
        </span>
      </div>
    </section>
  );
};

export default AudioCasterPlayer;
