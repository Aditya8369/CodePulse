"use client";

import { useState, useEffect } from "react";
import { Activity, GitCommit, GitPullRequest, Star, Flame, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveActivityRadarProps {
  username: string;
}

export function LiveActivityRadar({ username }: LiveActivityRadarProps) {
  const [events, setEvents] = useState([
    {
      id: "ev-1",
      type: "LIVE_PUSH",
      text: "Pushed 2 commits to code-with-abhi-i5/CodePulse",
      time: "Just now",
      icon: <GitCommit className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: "ev-2",
      type: "PR_OPENED",
      text: "Opened Pull Request #204 in react-nexus",
      time: "2m ago",
      icon: <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: "ev-3",
      type: "STAR_RECEIVED",
      text: "Received a new star on dev-arsenal",
      time: "12m ago",
      icon: <Star className="w-3.5 h-3.5 text-amber-400" />,
    },
  ]);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Activity Pulse</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">SSE Connected</span>
      </div>

      <div className="space-y-2.5">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all text-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">{ev.icon}</div>
              <span className="font-medium text-slate-200">{ev.text}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-3">{ev.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
