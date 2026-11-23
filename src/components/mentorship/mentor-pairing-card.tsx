"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  MessageSquare,
  Radio,
  Eye,
  Star,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentorPairingProfile {
  name: string;
  username: string;
  role: string;
  company?: string;
  avatarUrl: string;
  similarityScore: number;
  matchingTech: string[];
  experienceGap: number;
  bio: string;
  isAvailableNow: boolean;
  rating: number;
  sessionsCompleted: number;
}

export interface MentorPairingCardProps {
  mentor: MentorPairingProfile;
  onLaunchShadowCoding?: (mentor: MentorPairingProfile) => void;
  onRequestMentorship?: (mentor: MentorPairingProfile) => void;
  className?: string;
}

export function MentorPairingCard({
  mentor,
  onLaunchShadowCoding,
  onRequestMentorship,
  className,
}: MentorPairingCardProps) {
  return (
    <motion.div
      data-testid={`mentor-pairing-card-${mentor.username}`}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "rounded-2xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between hover:border-indigo-500/40 transition-all text-slate-100 space-y-4",
        className
      )}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={mentor.avatarUrl}
                alt={mentor.name}
                className="w-12 h-12 rounded-full border border-white/15 object-cover"
              />
              {mentor.isAvailableNow && (
                <span
                  data-testid={`available-pulse-${mentor.username}`}
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0B0F19] ring-2 ring-emerald-500/40 animate-pulse"
                  title="Available for Live Shadow Coding"
                />
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-white text-base">{mentor.name}</h3>
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-xs text-slate-400 font-mono">
                @{mentor.username} • {mentor.role}
              </div>
            </div>
          </div>

          {/* Cosine Similarity Score Badge */}
          <div
            data-testid={`match-badge-${mentor.username}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-xs shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            <span>{mentor.similarityScore}% Match</span>
          </div>
        </div>

        {/* Bio */}
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mt-3">
          {mentor.bio}
        </p>

        {/* Overlapping Tech Stack */}
        <div className="mt-4 space-y-1.5">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Matching Stack
          </span>
          <div className="flex flex-wrap gap-1.5">
            {mentor.matchingTech.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded-md bg-white/[0.04] text-cyan-300 text-[11px] font-mono font-medium border border-cyan-500/20"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Stats & Actions */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-bold text-slate-200">{mentor.rating}</span>
            <span>({mentor.sessionsCompleted} sessions)</span>
          </div>
          <span className="text-indigo-400 font-bold">+{mentor.experienceGap} yrs exp</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid={`request-mentor-btn-${mentor.username}`}
            onClick={() => onRequestMentorship?.(mentor)}
            className="py-2 px-3 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Request 1:1</span>
          </button>

          <button
            type="button"
            data-testid={`shadow-code-btn-${mentor.username}`}
            onClick={() => onLaunchShadowCoding?.(mentor)}
            className="py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Shadow Code</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
