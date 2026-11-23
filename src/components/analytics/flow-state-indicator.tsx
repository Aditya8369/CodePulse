"use client";

import React, { useState } from "react";
import { Brain, Coffee, Sparkles, X } from "lucide-react";

export interface FlowStateIndicatorProps {
  flowScore: number; // 0..100
  cognitiveFatigueIndex: number; // 0..100
  activeFlowMinutes: number;
  nudgeMessage?: string | null;
  actionableTip?: string | null;
}

export const FlowStateIndicator: React.FC<FlowStateIndicatorProps> = ({
  flowScore,
  cognitiveFatigueIndex,
  activeFlowMinutes,
  nudgeMessage,
  actionableTip,
}) => {
  const [dismissed, setDismissed] = useState(false);

  const default90MinNudge =
    activeFlowMinutes >= 90
      ? "You have been in intense flow for 90 minutes. Take a 5-minute breather!"
      : null;

  const activeNudge = nudgeMessage ?? default90MinNudge;

  const statusTone =
    cognitiveFatigueIndex >= 65
      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
      : flowScore >= 75
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
        : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";

  return (
    <aside
      aria-label="Developer Flow State and Cognitive Telemetry"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-white">
              Flow & Cognitive Focus Telemetry
            </div>
            <div className="font-mono text-[11px] text-zinc-400">
              Active session: {activeFlowMinutes} min
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span
            data-testid="flow-score-pill"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${statusTone}`}
          >
            <Sparkles className="h-3 w-3" />
            Flow: {flowScore}/100
          </span>
          <span
            data-testid="fatigue-index-pill"
            className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-zinc-300"
          >
            Fatigue: {cognitiveFatigueIndex}/100
          </span>
        </div>
      </div>

      {/* Gentle, non-intrusive inline wellness nudge (no modal popup) */}
      {activeNudge && !dismissed && (
        <div
          role="status"
          data-testid="gentle-wellness-nudge"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100"
        >
          <div className="flex items-start gap-2">
            <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium">{activeNudge}</p>
              {actionableTip && (
                <p className="mt-0.5 text-[11px] text-emerald-200/80">{actionableTip}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss wellness nudge"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-emerald-300 hover:bg-emerald-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
};

export default FlowStateIndicator;
