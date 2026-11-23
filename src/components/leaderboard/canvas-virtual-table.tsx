"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  VirtualScrollEngine,
  CompetitorEntry,
  CompetitorTier,
} from "@/lib/ui/virtual-scroll-engine";
import { Search, Trophy, Shield, Flame, User } from "lucide-react";

export interface CanvasVirtualTableProps {
  competitors?: CompetitorEntry[];
  totalCount?: number;
  onSelectCompetitor?: (competitor: CompetitorEntry) => void;
  className?: string;
}

const TIER_COLORS: Record<CompetitorTier, string> = {
  GRANDMASTER: "#f43f5e", // Rose neon
  DIAMOND: "#06b6d4",    // Cyan neon
  PLATINUM: "#10b981",   // Emerald
  GOLD: "#f59e0b",       // Amber
  SILVER: "#94a3b8",     // Slate
  BRONZE: "#b45309",     // Bronze
};

export function CanvasVirtualTable({
  competitors: initialCompetitors,
  totalCount = 100000,
  onSelectCompetitor,
  className = "",
}: CanvasVirtualTableProps) {
  // Generate 100,000 synthetic ranked competitors if none provided
  const allCompetitors = useMemo<CompetitorEntry[]>(() => {
    if (initialCompetitors && initialCompetitors.length > 0) {
      return initialCompetitors;
    }

    const tiers: CompetitorTier[] = [
      "GRANDMASTER", "DIAMOND", "PLATINUM", "GOLD", "SILVER", "BRONZE"
    ];
    const countries = ["US", "IN", "DE", "JP", "GB", "CA", "FR", "SG", "BR", "KR"];

    return Array.from({ length: totalCount }, (_, i) => {
      const rank = i + 1;
      const elo = Math.max(800, 2600 - Math.floor(i * 0.018));
      let tier: CompetitorTier = "BRONZE";
      if (elo >= 2400) tier = "GRANDMASTER";
      else if (elo >= 2100) tier = "DIAMOND";
      else if (elo >= 1800) tier = "PLATINUM";
      else if (elo >= 1500) tier = "GOLD";
      else if (elo >= 1200) tier = "SILVER";

      return {
        rank,
        userId: `user-${rank}`,
        username: `CodeKnight_${rank}`,
        elo,
        tier,
        winRatePct: Number((50 + ((100000 - i) / 100000) * 35).toFixed(1)),
        streak: (rank % 7) + 1,
        matchesPlayed: 100 + (rank % 300),
        countryCode: countries[rank % countries.length],
      };
    });
  }, [initialCompetitors, totalCount]);

  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredEntry, setHoveredEntry] = useState<CompetitorEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollEngineRef = useRef<VirtualScrollEngine>(new VirtualScrollEngine(48, 5));

  // Filtered dataset
  const filteredCompetitors = useMemo(() => {
    if (!searchQuery.trim()) return allCompetitors;
    return scrollEngineRef.current.filterByPrefix(allCompetitors, searchQuery);
  }, [allCompetitors, searchQuery]);

  // Touch & drag tracking
  const touchStartYRef = useRef(0);
  const lastTouchTimeRef = useRef(0);

  // Render Canvas Rows
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    scrollEngineRef.current.setViewport(height, filteredCompetitors.length);
    const win = scrollEngineRef.current.computeWindow();

    const rowHeight = 48;
    const colRank = 20;
    const colUser = 110;
    const colTier = width * 0.45;
    const colElo = width * 0.65;
    const colWinRate = width * 0.82;

    for (let idx = win.startIndex; idx <= win.endIndex; idx++) {
      if (idx >= filteredCompetitors.length) break;
      const comp = filteredCompetitors[idx];
      const y = (idx - win.startIndex) * rowHeight + win.offsetY;

      // Row background zebra striping
      ctx.fillStyle = idx % 2 === 0 ? "rgba(15, 23, 42, 0.4)" : "rgba(30, 41, 59, 0.25)";
      ctx.fillRect(0, y, width, rowHeight - 1);

      // Rank Column
      ctx.font = "bold 13px monospace";
      if (comp.rank === 1) {
        ctx.fillStyle = "#fbbf24"; // Gold
        ctx.fillText(`👑 #1`, colRank, y + 29);
      } else if (comp.rank === 2) {
        ctx.fillStyle = "#cbd5e1"; // Silver
        ctx.fillText(`🥈 #2`, colRank, y + 29);
      } else if (comp.rank === 3) {
        ctx.fillStyle = "#d97706"; // Bronze
        ctx.fillText(`🥉 #3`, colRank, y + 29);
      } else {
        ctx.fillStyle = "#64748b";
        ctx.fillText(`#${comp.rank}`, colRank, y + 29);
      }

      // Username & Flag
      ctx.font = "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(comp.username, colUser, y + 29);

      ctx.font = "11px monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`[${comp.countryCode}]`, colUser + ctx.measureText(comp.username).width + 8, y + 28);

      // Tier Badge
      const tierColor = TIER_COLORS[comp.tier] || "#94a3b8";
      ctx.fillStyle = tierColor;
      ctx.beginPath();
      ctx.roundRect(colTier, y + 14, 88, 20, 4);
      ctx.fillStyle = `${tierColor}18`;
      ctx.fill();
      ctx.strokeStyle = `${tierColor}50`;
      ctx.stroke();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = tierColor;
      ctx.fillText(comp.tier, colTier + 8, y + 28);

      // ELO Rating
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`${comp.elo} ELO`, colElo, y + 29);

      // Win Rate & Streak
      ctx.font = "12px monospace";
      ctx.fillStyle = "#10b981";
      ctx.fillText(`${comp.winRatePct}% WR`, colWinRate, y + 29);
    }

    ctx.restore();
  }, [filteredCompetitors]);

  // Inertial physics animation frame loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      const isMoving = scrollEngineRef.current.tickPhysics();
      renderCanvas();
      if (isMoving) {
        animId = requestAnimationFrame(loop);
      }
    };

    renderCanvas();
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Mouse wheel scroll handler
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    scrollEngineRef.current.applyDeltaY(e.deltaY);
    renderCanvas();
  };

  // Mouse move hover hit testing
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitIndex = scrollEngineRef.current.hitTest(y);
    if (hitIndex !== null && hitIndex < filteredCompetitors.length) {
      setHoveredEntry(filteredCompetitors[hitIndex]);
      setTooltipPos({ x: Math.min(x + 20, rect.width - 240), y: Math.min(y + 10, rect.height - 120) });
    } else {
      setHoveredEntry(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredEntry(null);
  };

  const handleClick = () => {
    if (hoveredEntry && onSelectCompetitor) {
      onSelectCompetitor(hoveredEntry);
    }
  };

  return (
    <div className={`flex flex-col w-full h-[620px] rounded-xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl ${className}`}>
      {/* Control Bar: Search & 100k Badge */}
      <div className="h-14 px-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Global Competitive Ladder</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-950 border border-cyan-800 text-cyan-400">
            {filteredCompetitors.length.toLocaleString()} Competitors
          </span>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search competitor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition"
          />
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="h-9 px-4 border-b border-slate-800/60 bg-slate-950/80 text-[11px] font-mono text-slate-400 flex items-center">
        <span className="w-24">RANK</span>
        <span className="flex-1 pl-4">COMPETITOR</span>
        <span className="w-32">TIER</span>
        <span className="w-36">ELO</span>
        <span className="w-28">WIN RATE</span>
      </div>

      {/* 1 Canvas Element with 100,000 Virtualized Rows */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="absolute inset-0 cursor-pointer block"
        />

        {/* Hover Popover Tooltip */}
        {hoveredEntry && tooltipPos && (
          <div
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            className="absolute z-20 pointer-events-none p-3 rounded-lg bg-slate-900 border border-cyan-500/40 shadow-xl shadow-black/80 text-xs font-mono w-56 space-y-1.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-bold text-white text-sm">#{hoveredEntry.rank} {hoveredEntry.username}</span>
              <span className="text-[10px] text-slate-400">{hoveredEntry.countryCode}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Rating:</span>
              <span className="text-cyan-400 font-bold">{hoveredEntry.elo} ELO</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Win Rate:</span>
              <span className="text-emerald-400">{hoveredEntry.winRatePct}%</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Current Streak:</span>
              <span className="text-amber-400">🔥 {hoveredEntry.streak} Wins</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CanvasVirtualTable;
