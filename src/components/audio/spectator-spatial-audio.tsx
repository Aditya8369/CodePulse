"use client";

import React, { useState } from "react";
import { Mic, MicOff, Volume2, Sliders, Radio, Headphones } from "lucide-react";

export interface CompetitorAudioTrack {
  userId: string;
  username: string;
  role: "player1" | "player2";
  panning: number; // -1 to +1
  volume: number;  // 0 to 1
  isSpeaking: boolean;
  muted: boolean;
}

export interface SpectatorSpatialAudioProps {
  battleId: string;
  initialPlayers?: CompetitorAudioTrack[];
  onVolumeChange?: (userId: string, volume: number) => void;
  onPanningChange?: (userId: string, panning: number) => void;
  onMuteToggle?: (userId: string, muted: boolean) => void;
}

export const SpectatorSpatialAudio: React.FC<SpectatorSpatialAudioProps> = ({
  battleId,
  initialPlayers = [
    {
      userId: "p1",
      username: "Player 1 (Left Channel)",
      role: "player1",
      panning: -0.3,
      volume: 0.85,
      isSpeaking: true,
      muted: false,
    },
    {
      userId: "p2",
      username: "Player 2 (Right Channel)",
      role: "player2",
      panning: 0.3,
      volume: 0.85,
      isSpeaking: false,
      muted: false,
    },
  ],
  onVolumeChange,
  onPanningChange,
  onMuteToggle,
}) => {
  const [players, setPlayers] = useState<CompetitorAudioTrack[]>(initialPlayers);
  const [spatialMode, setSpatialMode] = useState<boolean>(true);

  const handleVolume = (userId: string, val: number) => {
    setPlayers((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, volume: val } : p)),
    );
    if (onVolumeChange) onVolumeChange(userId, val);
  };

  const handlePanning = (userId: string, val: number) => {
    setPlayers((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, panning: val } : p)),
    );
    if (onPanningChange) onPanningChange(userId, val);
  };

  const handleMute = (userId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.userId === userId) {
          const next = !p.muted;
          if (onMuteToggle) onMuteToggle(userId, next);
          return { ...p, muted: next };
        }
        return p;
      }),
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0d14] p-5 text-white shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-sky-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">
            Spatial Voice Mix
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
            VAD ACTIVE (60% BANDWIDTH SAVED)
          </span>
        </div>

        <button
          onClick={() => setSpatialMode(!spatialMode)}
          className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
            spatialMode
              ? "bg-sky-500/20 border-sky-500 text-sky-300"
              : "bg-white/5 border-white/10 text-white/50"
          }`}
        >
          {spatialMode ? "3D Stereo Panning: ON" : "Mono Mix"}
        </button>
      </div>

      {/* Competitor Audio Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {players.map((player) => (
          <div
            key={player.userId}
            className={`p-3.5 rounded-xl border transition-all ${
              player.isSpeaking && !player.muted
                ? "bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                : "bg-white/[0.02] border-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    player.isSpeaking && !player.muted
                      ? "bg-emerald-400 animate-ping"
                      : "bg-white/20"
                  }`}
                />
                <span className="text-xs font-semibold text-white/90">{player.username}</span>
              </div>

              <button
                onClick={() => handleMute(player.userId)}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  player.muted
                    ? "bg-red-500/20 border-red-500/50 text-red-300"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
                title={player.muted ? "Unmute" : "Mute"}
              >
                {player.muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-[11px] text-white/60">
                <span>Volume</span>
                <span>{Math.round(player.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={player.volume}
                disabled={player.muted}
                onChange={(e) => handleVolume(player.userId, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            {/* Stereo Panning Slider (-1 to +1) */}
            {spatialMode && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-white/60">
                  <span>Pan (L / R)</span>
                  <span>{player.panning < 0 ? `${Math.abs(Math.round(player.panning * 100))}% L` : `${Math.round(player.panning * 100)}% R`}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={player.panning}
                  disabled={player.muted}
                  onChange={(e) => handlePanning(player.userId, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

