'use client';

import React from 'react';
import { UserCheck, Sparkles, MessageSquare, Award } from 'lucide-react';

interface MentorCardProps {
  mentor: {
    username: string;
    name: string;
    avatarUrl: string;
    similarityScore: number;
    matchingTech: string[];
    experienceGap: number;
    bio: string;
  };
}

export const MentorCard: React.FC<MentorCardProps> = ({ mentor }) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm hover:border-primary/40 transition space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img
            src={mentor.avatarUrl}
            alt={mentor.name}
            className="w-12 h-12 rounded-full border border-border object-cover"
          />
          <div>
            <h4 className="font-bold text-foreground text-base">{mentor.name}</h4>
            <div className="text-xs font-mono text-muted-foreground">@{mentor.username}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{mentor.similarityScore}% Match</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {mentor.bio}
      </p>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Overlapping Tech Stack
        </div>
        <div className="flex flex-wrap gap-1.5">
          {mentor.matchingTech.map(tech => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono font-medium border border-primary/20"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border/50 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">+{mentor.experienceGap} yrs</span> senior exp
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition shadow-sm">
          <MessageSquare className="w-3.5 h-3.5" /> Request Mentorship
        </button>
      </div>
    </div>
  );
};
