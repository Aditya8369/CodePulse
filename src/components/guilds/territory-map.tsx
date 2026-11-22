"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Map,
  Shield,
  Swords,
  Flame,
  Crown,
  Zap,
  Crosshair,
  Radio,
  Timer,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TacticalSector {
  id: string;
  name: string;
  type: "core" | "citadel" | "fortress" | "hub" | "nexus";
  controllingGuild: string | null;
  guildTag: string | null;
  controlPercent: number;
  defenseShield: number;
  xpYieldPerHour: number;
  status: "controlled" | "contested" | "neutral";
  coordinates: { x: number; y: number };
}

export const DEFAULT_TACTICAL_SECTORS: TacticalSector[] = [
  {
    id: "sec-alpha",
    name: "Sector Alpha: Kernel Core",
    type: "core",
    controllingGuild: "Kernel Hackers",
    guildTag: "KERN",
    controlPercent: 88,
    defenseShield: 94,
    xpYieldPerHour: 650,
    status: "controlled",
    coordinates: { x: 22, y: 32 },
  },
  {
    id: "sec-beta",
    name: "Sector Beta: Frontend Citadel",
    type: "citadel",
    controllingGuild: "NextJS Ninjas",
    guildTag: "NEXT",
    controlPercent: 62,
    defenseShield: 58,
    xpYieldPerHour: 500,
    status: "contested",
    coordinates: { x: 74, y: 26 },
  },
  {
    id: "sec-gamma",
    name: "Sector Gamma: Cloud Fortress",
    type: "fortress",
    controllingGuild: "OpenSource Avengers",
    guildTag: "AVENGER",
    controlPercent: 95,
    defenseShield: 100,
    xpYieldPerHour: 800,
    status: "controlled",
    coordinates: { x: 48, y: 52 },
  },
  {
    id: "sec-delta",
    name: "Sector Delta: AI Research Hub",
    type: "hub",
    controllingGuild: "Rustaceans Elite",
    guildTag: "RUST",
    controlPercent: 71,
    defenseShield: 68,
    xpYieldPerHour: 550,
    status: "contested",
    coordinates: { x: 28, y: 76 },
  },
  {
    id: "sec-omega",
    name: "Sector Omega: Quantum Nexus",
    type: "nexus",
    controllingGuild: null,
    guildTag: null,
    controlPercent: 0,
    defenseShield: 0,
    xpYieldPerHour: 1200,
    status: "neutral",
    coordinates: { x: 80, y: 72 },
  },
];

interface TerritoryMapProps {
  sectors?: TacticalSector[];
  userGuildTag?: string;
  onAttackSector?: (sector: TacticalSector) => void;
  onReinforceSector?: (sector: TacticalSector) => void;
}

export function TerritoryMap({
  sectors = DEFAULT_TACTICAL_SECTORS,
  userGuildTag = "AVENGER",
  onAttackSector,
  onReinforceSector,
}: TerritoryMapProps) {
  const [selectedSector, setSelectedSector] = useState<TacticalSector | null>(sectors[2]);
  const [filter, setFilter] = useState<"all" | "contested" | "controlled" | "neutral">("all");

  const filteredSectors = sectors.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const handleAction = (action: "attack" | "reinforce", sector: TacticalSector) => {
    if (action === "attack") {
      onAttackSector?.(sector);
      toast.success(`Skirmish initiated on ${sector.name}!`, {
        description: `Your guild is contesting control (+${sector.xpYieldPerHour} XP/hr prize).`,
      });
    } else {
      onReinforceSector?.(sector);
      toast.success(`Shield reinforced on ${sector.name}!`, {
        description: "Added +10% defense shield integrity.",
      });
    }
  };

  return (
    <div
      data-testid="clan-territory-map-container"
      role="region"
      aria-label="Clan War Territory Conquest Map"
      className="p-6 sm:p-8 rounded-[32px] bg-slate-950/90 border border-white/10 shadow-2xl relative overflow-hidden space-y-6"
    >
      {/* Header telemetry bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400 mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Live Clan War Season 4</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-cyan-400" />
            <span>Territory Conquest Tactical Map</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hold strategic code repositories to earn hourly clan XP bonuses and seasonal territory crests
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
          {(["all", "contested", "controlled", "neutral"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              data-testid={`filter-territory-${mode}`}
              onClick={() => setFilter(mode)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                filter === mode
                  ? "bg-cyan-500 text-black shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2D Tactical Battlefield Canvas & Inspection View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive 2D Tactical Map Viewport */}
        <div className="lg:col-span-2 relative aspect-[16/10] min-h-[340px] rounded-2xl bg-[#070A12] border border-cyan-500/20 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Tactical Radar Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.06) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Sweeping Radar Scanner Line */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent pointer-events-none animate-pulse" />

          {/* Tactical Sector Nodes */}
          {filteredSectors.map((sector) => {
            const isSelected = selectedSector?.id === sector.id;
            const isFriendly = sector.guildTag === userGuildTag;
            const isContested = sector.status === "contested";

            return (
              <button
                key={sector.id}
                type="button"
                data-testid={`sector-node-${sector.id}`}
                onClick={() => setSelectedSector(sector)}
                style={{
                  left: `${sector.coordinates.x}%`,
                  top: `${sector.coordinates.y}%`,
                }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-full",
                  isSelected ? "scale-125 z-30" : "hover:scale-110 z-20"
                )}
                title={`${sector.name} (${sector.controlPercent}% Control)`}
              >
                {/* Outer Contested Pulse Ring */}
                {isContested && (
                  <div className="absolute -inset-3 rounded-full border-2 border-rose-500/60 animate-ping opacity-60 pointer-events-none" />
                )}

                {/* Node Pillar */}
                <div
                  className={cn(
                    "w-11 h-11 sm:w-13 sm:h-13 rounded-2xl border-2 flex flex-col items-center justify-center shadow-xl backdrop-blur-md transition-all",
                    isFriendly
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-cyan-500/30"
                      : isContested
                      ? "bg-rose-500/20 border-rose-400 text-rose-300 shadow-rose-500/30"
                      : sector.status === "neutral"
                      ? "bg-slate-800/60 border-slate-600 text-slate-400"
                      : "bg-amber-500/20 border-amber-400 text-amber-300 shadow-amber-500/20"
                  )}
                >
                  <Crosshair className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-mono font-bold leading-none">
                    {sector.guildTag || "FREE"}
                  </span>
                </div>

                {/* Micro Label Pill */}
                <div
                  className={cn(
                    "absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-mono whitespace-nowrap shadow-md pointer-events-none border",
                    isSelected
                      ? "bg-cyan-500 text-black font-bold border-cyan-400"
                      : "bg-slate-900/90 text-slate-300 border-white/10"
                  )}
                >
                  {sector.controlPercent}%
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Sector Telemetry & Action Drawer */}
        <div className="rounded-2xl p-6 bg-slate-900/80 border border-white/10 flex flex-col justify-between space-y-6">
          {selectedSector ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Sector Telemetry
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                    selectedSector.status === "contested"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : selectedSector.status === "controlled"
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  )}
                >
                  {selectedSector.status}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedSector.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type: <span className="text-slate-300 uppercase font-mono">{selectedSector.type}</span>
                </p>
              </div>

              {/* Controlling Guild Info */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Occupying Clan:</span>
                  <span className="text-white font-bold">
                    {selectedSector.controllingGuild
                      ? `${selectedSector.controllingGuild} [${selectedSector.guildTag}]`
                      : "Unclaimed Territory"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Conquest Control:</span>
                  <span className="text-cyan-400 font-mono font-bold">
                    {selectedSector.controlPercent}%
                  </span>
                </div>
                {/* Control bar */}
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                    style={{ width: `${selectedSector.controlPercent}%` }}
                  />
                </div>
              </div>

              {/* Sector Rewards & Defense Shield */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-muted-foreground text-[10px] block">Yield Rate</span>
                  <span className="text-amber-300 font-bold font-mono flex items-center gap-1 mt-0.5">
                    <Zap className="w-3.5 h-3.5 fill-amber-400" />
                    +{selectedSector.xpYieldPerHour} XP/hr
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-muted-foreground text-[10px] block">Defense Shield</span>
                  <span className="text-emerald-400 font-bold font-mono flex items-center gap-1 mt-0.5">
                    <Shield className="w-3.5 h-3.5" />
                    {selectedSector.defenseShield}%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {selectedSector.guildTag === userGuildTag ? (
                  <button
                    type="button"
                    data-testid="reinforce-sector-btn"
                    onClick={() => handleAction("reinforce", selectedSector)}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-lg shadow-cyan-500/25 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-4 h-4" /> Reinforce Defense Shield
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="attack-sector-btn"
                    onClick={() => handleAction("attack", selectedSector)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/25 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Swords className="w-4 h-4" /> Launch Conquest Skirmish
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground text-xs">
              Click any tactical sector on the radar map to view telemetry and deploy forces.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
