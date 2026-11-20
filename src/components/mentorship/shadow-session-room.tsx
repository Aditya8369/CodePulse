"use client";

import React, { useState } from "react";
import {
  Code,
  Users,
  Mic,
  MicOff,
  UserCheck,
  Eye,
  FileCode,
  Award,
  Clock,
  Sparkles,
} from "lucide-react";

export interface ShadowSessionState {
  sessionId: string;
  title: string;
  mentorName: string;
  apprenticeName: string;
  driverSeat: "MENTOR" | "APPRENTICE";
  isAudioConnected: boolean;
  activeFile: string;
  cursorLine: number;
  cursorCol: number;
  viewportTopLine: number;
  scratchpadNotes: string;
  latencyMs: number;
}

export interface ShadowSessionRoomProps {
  initialSession?: Partial<ShadowSessionState>;
  currentUserId?: string;
  onDriverSeatHandover?: (newDriver: "MENTOR" | "APPRENTICE") => void;
}

export const ShadowSessionRoom: React.FC<ShadowSessionRoomProps> = ({
  initialSession,
  currentUserId = "mentor-1",
  onDriverSeatHandover,
}) => {
  const [session, setSession] = useState<ShadowSessionState>({
    sessionId: initialSession?.sessionId || "sess_shadow_772",
    title: initialSession?.title || "Optimizing RocksDB LSM Compaction",
    mentorName: initialSession?.mentorName || "Sarah (Staff SRE)",
    apprenticeName: initialSession?.apprenticeName || "Alex (Junior Dev)",
    driverSeat: initialSession?.driverSeat || "MENTOR",
    isAudioConnected: initialSession?.isAudioConnected ?? true,
    activeFile: initialSession?.activeFile || "compactor.ts",
    cursorLine: initialSession?.cursorLine || 42,
    cursorCol: initialSession?.cursorCol || 18,
    viewportTopLine: initialSession?.viewportTopLine || 30,
    scratchpadNotes:
      initialSession?.scratchpadNotes ||
      "• Focus on level-0 flush stalls\n• Avoid write amplification on NVMe drives",
    latencyMs: initialSession?.latencyMs || 14,
  });

  const [notes, setNotes] = useState(session.scratchpadNotes);

  const toggleDriverSeat = () => {
    const nextDriver = session.driverSeat === "MENTOR" ? "APPRENTICE" : "MENTOR";
    setSession((prev) => ({ ...prev, driverSeat: nextDriver }));
    onDriverSeatHandover?.(nextDriver);
  };

  const toggleAudio = () => {
    setSession((prev) => ({ ...prev, isAudioConnected: !prev.isAudioConnected }));
  };

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/10 bg-white/[0.02] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{session.title}</h2>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE SHADOW
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>Mentor: <strong className="text-foreground">{session.mentorName}</strong></span>
              <span>•</span>
              <span>Apprentice: <strong className="text-foreground">{session.apprenticeName}</strong></span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Driver Seat Badge & Toggle Button */}
          <button
            onClick={toggleDriverSeat}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border shadow-sm ${
              session.driverSeat === "MENTOR"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30"
                : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Driver: {session.driverSeat} (Hand Over Seat)
          </button>

          {/* Audio commentary toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-xl text-xs border transition-colors ${
              session.isAudioConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
            }`}
            title="Toggle Live Audio Commentary"
          >
            {session.isAudioConnected ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-[420px]">
        {/* Editor Viewport & Follow-Mode */}
        <div className="lg:col-span-2 p-4 flex flex-col justify-between bg-black/20">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
              <div className="flex items-center gap-2 font-mono text-muted-foreground">
                <FileCode className="w-3.5 h-3.5 text-primary" />
                <span>{session.activeFile}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3 text-primary" />
                  Follow Viewport: Ln {session.cursorLine}, Col {session.cursorCol}
                </span>
                <span>•</span>
                <span className="text-emerald-400">Sync lag: {session.latencyMs}ms</span>
              </div>
            </div>

            {/* Simulated Code Viewport */}
            <div className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground select-none">
              <div className="flex items-center gap-3 py-0.5">
                <span className="text-white/30 w-6 text-right">40</span>
                <span className="text-purple-400">export async function</span>{" "}
                <span className="text-amber-300">compactLevelZeroFiles</span>() {"{"}
              </div>
              <div className="flex items-center gap-3 py-0.5">
                <span className="text-white/30 w-6 text-right">41</span>
                <span className="text-white/50 pl-4">// Mentor cursor highlighted</span>
              </div>
              <div className="flex items-center gap-3 py-0.5 bg-primary/10 rounded px-1 -mx-1 border-l-2 border-primary">
                <span className="text-white/30 w-6 text-right font-bold text-primary">42</span>
                <span className="text-foreground pl-4">
                  const sstables = await this.readTableManifest();
                  <span className="inline-block w-1.5 h-3.5 bg-primary ml-1 animate-pulse" />
                </span>
              </div>
              <div className="flex items-center gap-3 py-0.5">
                <span className="text-white/30 w-6 text-right">43</span>
                <span className="text-foreground pl-4">return this.mergeSortBlocks(sstables);</span>
              </div>
              <div className="flex items-center gap-3 py-0.5">
                <span className="text-white/30 w-6 text-right">44</span>
                <span className="text-purple-400">{"}"}</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground pt-4 border-t border-white/5 flex items-center justify-between">
            <span>
              {session.driverSeat === "MENTOR"
                ? "Mentor is in the driver seat. Apprentice viewport automatically tracks active scroll."
                : "Apprentice has the wheel. Mentor providing live commentary & review."}
            </span>
            <span className="flex items-center gap-1 text-primary">
              <Clock className="w-3 h-3" /> 45 min elapsed
            </span>
          </div>
        </div>

        {/* Scratchpad & Mentorship Milestone Sidebar */}
        <div className="p-4 flex flex-col justify-between bg-white/[0.01]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-primary" /> Shared Scratchpad
              </span>
              <span className="text-[10px] text-muted-foreground">Auto-saved</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take collaborative notes, ask questions or paste snippets..."
              className="mt-3 w-full h-44 rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-mono"
            />
          </div>

          {/* Certified Mentor Progress */}
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-semibold mb-1">
              <Award className="w-4 h-4 text-amber-400" />
              Certified Mentor Track
            </div>
            <p className="text-[11px] text-amber-200/80 mb-2">
              Complete 20 verified shadow mentorship sessions to earn the platform credential badge.
            </p>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-400 h-full rounded-full w-[85%]" />
            </div>
            <div className="flex justify-between items-center text-[10px] text-amber-300/80 mt-1.5">
              <span>Progress: 17 / 20 Sessions</span>
              <span>3 to unlock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
