"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Code2,
  GitCommit,
  GitPullRequest,
  Trophy,
  Flame,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  Share2,
  CheckCircle2,
  Filter,
  BarChart2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SkillDomain = "ALL" | "FRONTEND" | "BACKEND" | "DEVOPS" | "ALGORITHMS";

export interface DeveloperSkill {
  id: string;
  name: string;
  domain: "FRONTEND" | "BACKEND" | "DEVOPS" | "ALGORITHMS";
  proficiency: number; // 0 to 100
  experienceXp: number;
  commitsCount: number;
  pullRequestsMerged: number;
  topRank?: string;
  color: string;
}

export interface CommitDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface DeveloperSkillMatrixProps {
  username?: string;
  skills?: DeveloperSkill[];
  totalContributions?: number;
  currentStreak?: number;
  className?: string;
}

const DEFAULT_SKILLS: DeveloperSkill[] = [
  {
    id: "s-react",
    name: "React & Next.js",
    domain: "FRONTEND",
    proficiency: 95,
    experienceXp: 18400,
    commitsCount: 342,
    pullRequestsMerged: 48,
    topRank: "Master",
    color: "#38bdf8",
  },
  {
    id: "s-ts",
    name: "TypeScript",
    domain: "FRONTEND",
    proficiency: 92,
    experienceXp: 16200,
    commitsCount: 298,
    pullRequestsMerged: 41,
    topRank: "Master",
    color: "#3b82f6",
  },
  {
    id: "s-node",
    name: "Node.js & NestJS",
    domain: "BACKEND",
    proficiency: 88,
    experienceXp: 14100,
    commitsCount: 215,
    pullRequestsMerged: 35,
    topRank: "Expert",
    color: "#22c55e",
  },
  {
    id: "s-go",
    name: "Go & Microservices",
    domain: "BACKEND",
    proficiency: 78,
    experienceXp: 8900,
    commitsCount: 124,
    pullRequestsMerged: 19,
    topRank: "Adept",
    color: "#06b6d4",
  },
  {
    id: "s-k8s",
    name: "Kubernetes & Docker",
    domain: "DEVOPS",
    proficiency: 82,
    experienceXp: 10400,
    commitsCount: 146,
    pullRequestsMerged: 22,
    topRank: "Expert",
    color: "#6366f1",
  },
  {
    id: "s-postgres",
    name: "PostgreSQL & Prisma",
    domain: "DEVOPS",
    proficiency: 85,
    experienceXp: 12800,
    commitsCount: 180,
    pullRequestsMerged: 27,
    topRank: "Expert",
    color: "#3b82f6",
  },
  {
    id: "s-algos",
    name: "Dynamic Programming",
    domain: "ALGORITHMS",
    proficiency: 90,
    experienceXp: 17500,
    commitsCount: 260,
    pullRequestsMerged: 39,
    topRank: "Grandmaster",
    color: "#f59e0b",
  },
  {
    id: "s-graphs",
    name: "Graph Theory & Trees",
    domain: "ALGORITHMS",
    proficiency: 84,
    experienceXp: 11200,
    commitsCount: 165,
    pullRequestsMerged: 25,
    topRank: "Expert",
    color: "#ec4899",
  },
];

// Generate 52 weeks of mock commit data
function generateYearHeatmap(): CommitDay[] {
  const days: CommitDay[] = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    // Simulate typical developer patterns: lower on weekends, higher mid-week
    const baseChance = dayOfWeek === 0 || dayOfWeek === 6 ? 0.35 : 0.8;
    const hasCommits = Math.random() < baseChance;
    const count = hasCommits ? Math.floor(Math.random() * 8) + 1 : 0;
    const level: 0 | 1 | 2 | 3 | 4 =
      count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;

    days.push({
      date: d.toISOString().split("T")[0],
      count,
      level,
    });
  }
  return days;
}

export function DeveloperSkillMatrix({
  username = "code-with-dipak-777",
  skills = DEFAULT_SKILLS,
  totalContributions = 1845,
  currentStreak = 42,
  className,
}: DeveloperSkillMatrixProps) {
  const [selectedDomain, setSelectedDomain] = useState<SkillDomain>("ALL");
  const [activeView, setActiveView] = useState<"MATRIX" | "HEATMAP">("MATRIX");
  const [selectedSkill, setSelectedSkill] = useState<DeveloperSkill | null>(null);

  const heatmapDays = useMemo(() => generateYearHeatmap(), []);

  const filteredSkills = useMemo(() => {
    if (selectedDomain === "ALL") return skills;
    return skills.filter((s) => s.domain === selectedDomain);
  }, [skills, selectedDomain]);

  const handleShareMatrix = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(
        `Check out @${username}'s Developer Skill Matrix on CodePulse: 95% React Master, 92% TypeScript Master with ${totalContributions} verified contributions!`
      );
      toast.success("Skill Matrix profile link copied to clipboard!");
    } else {
      toast.success("Skill Matrix shared successfully!");
    }
  };

  const getCellColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-emerald-950/70 border-emerald-800/40";
      case 2:
        return "bg-emerald-700/80 border-emerald-600/60";
      case 3:
        return "bg-emerald-500 border-emerald-400";
      case 4:
        return "bg-emerald-300 border-emerald-200 shadow-sm shadow-emerald-400/50";
      default:
        return "bg-white/[0.03] border-white/5";
    }
  };

  return (
    <div
      data-testid="developer-skill-matrix-container"
      className={cn(
        "w-full rounded-3xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-2xl p-6 shadow-2xl flex flex-col gap-6 text-slate-100",
        className
      )}
    >
      {/* Top Profile & Statistics Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
              VERIFIED DEVELOPER PROFILE
            </span>
            <span className="text-xs text-slate-400 font-mono">@{username}</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-indigo-400" />
            Developer Skill Matrix & Activity
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time competency assessment synthesized from ranked battles, GitHub PR merges, and AST telemetry.
          </p>
        </div>

        {/* Global Statistics Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-right">
            <div className="text-[10px] font-mono uppercase text-slate-400">Total Commits</div>
            <div data-testid="total-contributions-count" className="text-sm font-black font-mono text-cyan-300">
              {totalContributions.toLocaleString()}
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-right">
            <div className="text-[10px] font-mono uppercase text-amber-400 flex items-center gap-1">
              <Flame className="w-3 h-3 fill-amber-400" /> Current Streak
            </div>
            <div data-testid="current-streak-count" className="text-sm font-black font-mono text-amber-300">
              {currentStreak} Days
            </div>
          </div>

          <button
            type="button"
            data-testid="share-matrix-btn"
            onClick={handleShareMatrix}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
            title="Share Skill Matrix"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Domain Filter Tabs */}
        <div className="flex flex-wrap rounded-xl bg-white/[0.04] p-1 border border-white/10 text-xs w-full sm:w-auto">
          {(["ALL", "FRONTEND", "BACKEND", "DEVOPS", "ALGORITHMS"] as SkillDomain[]).map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`domain-tab-${d}`}
              onClick={() => setSelectedDomain(d)}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer",
                selectedDomain === d
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {d === "ALL" ? "All Domains" : d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* View Switcher: Matrix vs Heatmap */}
        <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 text-xs">
          <button
            type="button"
            data-testid="view-matrix-tab"
            onClick={() => setActiveView("MATRIX")}
            className={cn(
              "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              activeView === "MATRIX"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Skills Matrix
          </button>
          <button
            type="button"
            data-testid="view-heatmap-tab"
            onClick={() => setActiveView("HEATMAP")}
            className={cn(
              "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              activeView === "HEATMAP"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Calendar className="w-3.5 h-3.5" /> Contribution Heatmap
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeView === "MATRIX" ? (
        /* Skill Matrix Cards Grid */
        <div data-testid="skills-matrix-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredSkills.map((skill) => (
            <motion.div
              key={skill.id}
              data-testid={`skill-card-${skill.id}`}
              whileHover={{ y: -3 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedSkill(skill)}
              className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col justify-between shadow-lg hover:border-indigo-500/40"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    {skill.domain}
                  </span>
                  {skill.topRank && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                      {skill.topRank}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-white">{skill.name}</h3>

                {/* Proficiency Gauge */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Mastery</span>
                    <span className="font-bold text-cyan-300">{skill.proficiency}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                      style={{ width: `${skill.proficiency}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Skill Metrics Footer */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <GitCommit className="w-3 h-3 text-slate-500" /> {skill.commitsCount}
                </span>
                <span className="flex items-center gap-1">
                  <GitPullRequest className="w-3 h-3 text-slate-500" /> {skill.pullRequestsMerged} PRs
                </span>
                <span className="text-indigo-400 font-bold">
                  {(skill.experienceXp / 1000).toFixed(1)}k XP
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* GitHub Contribution Calendar Heatmap */
        <div data-testid="github-commit-heatmap-view" className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>52-Week Verified Activity Heatmap</span>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-white/[0.03] border border-white/5" />
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-950/70 border border-emerald-800/40" />
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-700/80 border border-emerald-600/60" />
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-400" />
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-300 border border-emerald-200" />
              <span>More</span>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
            <div className="min-w-[720px] grid grid-rows-7 grid-flow-col gap-1.5 p-3 rounded-2xl bg-black/40 border border-white/5">
              {heatmapDays.map((day) => (
                <div
                  key={day.date}
                  data-testid={`heatmap-cell-${day.date}`}
                  title={`${day.date}: ${day.count} commits`}
                  className={cn(
                    "w-3 h-3 rounded-sm border transition-colors hover:scale-125 cursor-pointer",
                    getCellColor(day.level)
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skill Detail Dialog */}
      {selectedSkill && (
        <div
          data-testid="skill-detail-dialog"
          role="dialog"
          className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-indigo-400">{selectedSkill.domain}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-amber-300 font-bold">{selectedSkill.topRank} Tier</span>
            </div>
            <h4 className="text-lg font-black text-white mt-0.5">{selectedSkill.name}</h4>
            <p className="text-xs text-slate-300 mt-1">
              Verified with {selectedSkill.commitsCount} commits, {selectedSkill.pullRequestsMerged} merged pull requests, and {selectedSkill.experienceXp.toLocaleString()} platform XP.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedSkill(null)}
            className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
