"use client";

import React, { useState } from "react";
import {
  Video,
  Layers,
  BarChart,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Radio,
  Tv,
} from "lucide-react";
import {
  CameraActivePlayer,
  CasterStudioState,
} from "../../../backend/src/modules/esports/caster-studio.service";

export interface DirectorControlPanelProps {
  tournamentId: string;
  initialState?: Partial<CasterStudioState>;
  onSwitchCamera?: (camera: CameraActivePlayer) => void;
  onToggleLowerThird?: (visible: boolean, title: string, subtitle: string) => void;
  onToggleStats?: (visible: boolean) => void;
  onTriggerReplay?: (speed: 0.25 | 0.5 | 0.75) => void;
}

export const DirectorControlPanel: React.FC<DirectorControlPanelProps> = ({
  tournamentId,
  initialState,
  onSwitchCamera,
  onToggleLowerThird,
  onToggleStats,
  onTriggerReplay,
}) => {
  const [activeCam, setActiveCam] = useState<CameraActivePlayer>(
    initialState?.activeCamera || "split_screen",
  );
  const [lowerThirdActive, setLowerThirdActive] = useState(
    initialState?.lowerThird?.visible || false,
  );
  const [statsActive, setStatsActive] = useState(
    initialState?.statComparison?.visible || false,
  );
  const [replayActive, setReplayActive] = useState(
    initialState?.slowMoReplay?.active || false,
  );

  const handleCameraChange = (cam: CameraActivePlayer) => {
    setActiveCam(cam);
    if (onSwitchCamera) onSwitchCamera(cam);
  };

  const handleLowerThirdToggle = () => {
    const next = !lowerThirdActive;
    setLowerThirdActive(next);
    if (onToggleLowerThird) {
      onToggleLowerThird(next, "Grand Championship Finals", "Match Point - Clutch Round");
    }
  };

  const handleStatsToggle = () => {
    const next = !statsActive;
    setStatsActive(next);
    if (onToggleStats) onToggleStats(next);
  };

  const handleReplayToggle = () => {
    const next = !replayActive;
    setReplayActive(next);
    if (onTriggerReplay && next) {
      onTriggerReplay(0.5);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1017] p-6 text-white shadow-2xl space-y-6">
      {/* Studio Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Tournament Caster Studio
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono font-bold">
                LIVE ON AIR
              </span>
            </h2>
            <p className="text-xs text-white/50">
              OBS Browser Source 1080p: /overlay/{tournamentId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          DIRECTOR AUTH: VERIFIED
        </div>
      </div>

      {/* Camera Switcher Grid */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3 block flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5 text-sky-400" />
          Active Camera Feed (Sub-50ms)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              { id: "split_screen", label: "Split Screen (1v1)", icon: Tv },
              { id: "player1", label: "Player 1 (Challenger)", icon: Video },
              { id: "player2", label: "Player 2 (Opponent)", icon: Video },
              { id: "overview", label: "Stadium Overview", icon: Layers },
            ] as const
          ).map((cam) => {
            const Icon = cam.icon;
            const isSelected = activeCam === cam.id;
            return (
              <button
                key={cam.id}
                onClick={() => handleCameraChange(cam.id)}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-red-500/20 border-red-500 text-red-200 shadow-lg shadow-red-500/20 scale-102"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? "text-red-400" : "text-white/60"}`} />
                {cam.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Broadcast Graphics & Overlays Trigger Bar */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3 block flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          Broadcast Overlays & Graphics
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Lower Third */}
          <button
            onClick={handleLowerThirdToggle}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition-all ${
              lowerThirdActive
                ? "bg-amber-500/20 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/20"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Lower Third Banner
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded ${
                lowerThirdActive ? "bg-amber-500/40 text-amber-200" : "bg-white/10 text-white/40"
              }`}
            >
              {lowerThirdActive ? "ON" : "OFF"}
            </span>
          </button>

          {/* Stat Comparison */}
          <button
            onClick={handleStatsToggle}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition-all ${
              statsActive
                ? "bg-sky-500/20 border-sky-500 text-sky-200 shadow-lg shadow-sky-500/20"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart className="w-4 h-4 text-sky-400" />
              Head-to-Head Stats
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded ${
                statsActive ? "bg-sky-500/40 text-sky-200" : "bg-white/10 text-white/40"
              }`}
            >
              {statsActive ? "ON" : "OFF"}
            </span>
          </button>

          {/* Slow-mo Replay */}
          <button
            onClick={handleReplayToggle}
            className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition-all ${
              replayActive
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/20 animate-pulse"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              Slow-Mo Instant Replay
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded ${
                replayActive ? "bg-emerald-500/40 text-emerald-200" : "bg-white/10 text-white/40"
              }`}
            >
              {replayActive ? "REPLAY" : "READY"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

