"use client";

import React, { useState, useEffect } from "react";
import { Flame, Rocket, Zap, Heart, PartyPopper } from "lucide-react";

export interface HypeTickEvent {
  battleId: string;
  hypeIndex: number; // 0 to 100
  stormActive: boolean;
  screenShake: boolean;
  densityVectors: Record<string, number>;
}

export interface LiveHypeMeterProps {
  battleId: string;
  initialHypeIndex?: number;
  onReact?: (emoji: string) => void;
}

export const LiveHypeMeter: React.FC<LiveHypeMeterProps> = ({
  battleId,
  initialHypeIndex = 25,
  onReact,
}) => {
  const [hypeIndex, setHypeIndex] = useState(initialHypeIndex);
  const [isStormActive, setIsStormActive] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number }>>([]);

  const handleEmojiClick = (emoji: string) => {
    // Add local particle immediately for responsive UI
    const id = Date.now() + Math.random();
    setParticles((prev) => [...prev.slice(-20), { id, emoji, x: Math.random() * 80 + 10 }]);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1200);

    if (onReact) {
      onReact(emoji);
    }
  };

  const getHypeColor = (val: number) => {
    if (val >= 90) return "from-red-500 via-orange-500 to-amber-400";
    if (val >= 60) return "from-amber-500 to-yellow-400";
    return "from-blue-500 to-cyan-400";
  };

  return (
    <div
      className={`relative p-4 rounded-2xl bg-black/40 border border-white/10 transition-all duration-300 ${
        isStormActive ? "shadow-2xl shadow-red-500/30 animate-pulse border-red-500/50" : ""
      }`}
    >
      {/* Floating Particle Storm Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        {particles.map((p) => (
          <span
            key={p.id}
            style={{ left: `${p.x}%` }}
            className="absolute bottom-4 text-2xl animate-bounce transition-all duration-1000"
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Meter Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame
            className={`w-4 h-4 ${
              hypeIndex >= 90 ? "text-red-400 animate-spin" : "text-amber-400"
            }`}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-white/90">
            Live Spectator Hype
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span
            className={`font-black ${
              hypeIndex >= 90 ? "text-red-400 text-sm" : "text-amber-400"
            }`}
          >
            {hypeIndex}
          </span>
          <span className="text-white/40">/100</span>
        </div>
      </div>

      {/* Hype Progress Gauge */}
      <div className="w-full h-3 rounded-full bg-white/5 border border-white/10 overflow-hidden mb-3 p-0.5">
        <div
          style={{ width: `${hypeIndex}%` }}
          className={`h-full rounded-full bg-gradient-to-r ${getHypeColor(
            hypeIndex,
          )} transition-all duration-300 shadow-lg`}
        />
      </div>

      {/* Emoji Reaction Triggers */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        {["🔥", "🚀", "😱", "👏", "⚡", "💀"].map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-base hover:scale-125 transition-transform active:scale-95"
            title={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
