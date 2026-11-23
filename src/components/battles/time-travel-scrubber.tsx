'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  History,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  SkipBack,
  SkipForward,
  Download,
} from 'lucide-react';
import type { ReplayTimelineMarker } from '@/lib/replay/state-recorder';

export interface TimeTravelScrubberProps {
  durationMs?: number;
  currentTimestampMs?: number;
  timelineMarkers?: ReplayTimelineMarker[];
  onSeek?: (timestampMs: number) => void;
  onExportSession?: () => void;
  className?: string;
}

export const TimeTravelScrubber: React.FC<TimeTravelScrubberProps> = ({
  durationMs = 60000,
  currentTimestampMs = 0,
  timelineMarkers = [],
  onSeek,
  onExportSession,
  className = '',
}) => {
  const [currentMs, setCurrentMs] = useState<number>(currentTimestampMs);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const playTimerRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  useEffect(() => {
    setCurrentMs(currentTimestampMs);
  }, [currentTimestampMs]);

  const handleSeek = (ms: number) => {
    const clamped = Math.max(0, Math.min(durationMs, ms));
    setCurrentMs(clamped);
    onSeek?.(clamped);
  };

  const handleStep = (deltaMs: number) => {
    handleSeek(currentMs + deltaMs);
  };

  // Playback loop
  const runPlayback = useCallback(
    (now: number) => {
      if (lastTickTimeRef.current > 0) {
        const delta = (now - lastTickTimeRef.current) * playbackSpeed;
        setCurrentMs((prev) => {
          const next = prev + delta;
          if (next >= durationMs) {
            setIsPlaying(false);
            onSeek?.(durationMs);
            return durationMs;
          }
          onSeek?.(next);
          return next;
        });
      }
      lastTickTimeRef.current = now;
      playTimerRef.current = requestAnimationFrame(runPlayback);
    },
    [durationMs, playbackSpeed, onSeek],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTickTimeRef.current = performance.now();
      playTimerRef.current = requestAnimationFrame(runPlayback);
    } else {
      if (playTimerRef.current) {
        cancelAnimationFrame(playTimerRef.current);
        playTimerRef.current = null;
      }
      lastTickTimeRef.current = 0;
    }

    return () => {
      if (playTimerRef.current) {
        cancelAnimationFrame(playTimerRef.current);
      }
    };
  }, [isPlaying, runPlayback]);

  const formatTimestamp = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const millis = Math.floor((ms % 1000) / 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${millis}`;
  };

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md p-4 shadow-2xl space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Time-Travel State Replay
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <span className="text-cyan-400 font-bold">{formatTimestamp(currentMs)}</span>
          <span className="text-slate-600">/</span>
          <span>{formatTimestamp(durationMs)}</span>
        </div>
      </div>

      {/* Scrubber Range with Marker Pins */}
      <div className="relative w-full pt-1 pb-2">
        <input
          type="range"
          min={0}
          max={durationMs}
          value={currentMs}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 z-10 relative"
        />

        {/* Timeline Marker Pins */}
        {durationMs > 0 &&
          timelineMarkers.map((marker, i) => {
            const leftPct = (marker.timestamp / durationMs) * 100;
            const markerColors = {
              TEST_PASS: 'bg-emerald-400 shadow-emerald-400/50',
              TEST_FAIL: 'bg-rose-400 shadow-rose-400/50',
              SABOTAGE: 'bg-purple-400 shadow-purple-400/50',
              CRITICAL_HP: 'bg-amber-400 shadow-amber-400/50',
            };

            return (
              <div
                key={i}
                style={{ left: `${leftPct}%` }}
                className={`absolute top-0 w-1.5 h-3 rounded-full shadow-sm cursor-pointer transform -translate-x-1/2 pointer-events-auto ${
                  markerColors[marker.type] || 'bg-white'
                }`}
                title={`${marker.label} (${formatTimestamp(marker.timestamp)})`}
                onClick={() => handleSeek(marker.timestamp)}
              />
            );
          })}
      </div>

      {/* Control Bar: Play / Pause, Speeds, Export */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSeek(0)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Reset to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleStep(-1000)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Back 1 second"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1 shadow-lg shadow-cyan-600/30 transition"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={() => handleStep(1000)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Forward 1 second"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-mono">
            {[0.5, 1.0, 2.0, 4.0].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-0.5 rounded-md transition ${
                  playbackSpeed === speed
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Export Session */}
          {onExportSession && (
            <button
              onClick={onExportSession}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
              title="Export Replay JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
