"use client";

import { Trophy, TrendingUp, GitCommitHorizontal, GitPullRequest, Flame, Star, Users, CircleDot, GitBranch, Code2, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DevComparisonData {
  username: string;
  name: string;
  avatar: string;
  globalRank: { title: string; percentile: number; color: string };
  stats: {
    totalCommits: number;
    totalPRs: number;
    totalIssues: number;
    totalStars: number;
    followers: number;
    streak: number;
    peakStreak: number;
    repos: number;
    linesAdded: number;
    linesDeleted: number;
  };
  topLanguages: { name: string; count: number }[];
  score: number;
}

export interface HeadToHeadData {
  user1Wins: number;
  user2Wins: number;
  draws: number;
  totalMatches: number;
  latest: {
    date: string;
    category: string;
    user1Score: number | null;
    user2Score: number | null;
    winner: string | null;
  } | null;
}

interface ComparisonMetricsTableProps {
  dev1: DevComparisonData;
  dev2: DevComparisonData;
  headToHead?: HeadToHeadData;
}

interface Metric {
  label: string;
  icon: React.ElementType;
  dev1Value: number | string;
  dev2Value: number | string;
  higherIsBetter: boolean;
  format?: (val: number | string) => string;
  dev1Username?: string;
  dev2Username?: string;
}

function MetricRow({
  label,
  icon: Icon,
  dev1Value,
  dev2Value,
  higherIsBetter,
  format = (v: number | string) => typeof v === "number" ? v.toLocaleString() : String(v),
  dev1Username,
  dev2Username,
}: Metric) {
  const num1 = typeof dev1Value === "number" ? dev1Value : parseFloat(String(dev1Value).replace(/,/g, "")) || 0;
  const num2 = typeof dev2Value === "number" ? dev2Value : parseFloat(String(dev2Value).replace(/,/g, "")) || 0;

  const dev1Wins = higherIsBetter ? num1 > num2 : num1 < num2;
  const dev2Wins = higherIsBetter ? num2 > num1 : num2 < num1;
  const isTie = num1 === num2;

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-zinc-400 shrink-0" />
          <span className="text-sm font-medium text-zinc-300">{label}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={cn(
            "text-lg font-bold tabular-nums transition-colors",
            dev1Wins && !isTie ? "text-emerald-400" : "text-white"
          )}>
            {format(dev1Value)}
          </span>
          {(dev1Wins && !isTie && dev1Username) && (
            <Trophy className="w-5 h-5 text-emerald-400 animate-bounce" aria-label={`${dev1Username} leads`} />
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="relative w-full max-w-xs">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                dev1Wins && !isTie ? "bg-emerald-500" : "bg-zinc-600"
              )}
              style={{
                width: num1 + num2 > 0 ? `${(num1 / (num1 + num2)) * 100}%` : "50%"
              }}
            />
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-left">
        <div className="relative w-full max-w-xs">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                dev2Wins && !isTie ? "bg-emerald-500" : "bg-zinc-600"
              )}
              style={{
                width: num1 + num2 > 0 ? `${(num2 / (num1 + num2)) * 100}%` : "50%"
              }}
            />
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-left">
        <div className="flex items-center justify-start gap-2">
          <span className={cn(
            "text-lg font-bold tabular-nums transition-colors",
            dev2Wins && !isTie ? "text-emerald-400" : "text-white"
          )}>
            {format(dev2Value)}
          </span>
          {(dev2Wins && !isTie && dev2Username) && (
            <Trophy className="w-5 h-5 text-emerald-400 animate-bounce" aria-label={`${dev2Username} leads`} />
          )}
        </div>
      </td>
    </tr>
  );
}

interface MetricSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function MetricSection({ title, icon: SectionIcon, children }: MetricSectionProps) {
  return (
    <tbody>
      <tr>
        <td colSpan={5} className="py-3 px-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            <SectionIcon className="w-4 h-4" />
            {title}
          </div>
        </td>
      </tr>
      {children}
    </tbody>
  );
}

export function ComparisonMetricsTable({ dev1, dev2, headToHead }: ComparisonMetricsTableProps) {
  const overlap = (() => {
    const firstNames = new Map(dev1.topLanguages.map((lang) => [lang.name.trim().toLowerCase(), lang.name] as const).filter(([key]) => key));
    const secondNames = new Set(dev2.topLanguages.map((lang) => lang.name.trim().toLowerCase()).filter(Boolean));
    const allNames = new Set([...firstNames.keys(), ...secondNames]);
    const shared = [...firstNames].filter(([key]) => key && secondNames.has(key)).map(([, label]) => label);
    return {
      shared,
      percentage: allNames.size ? Math.round((shared.length / allNames.size) * 100) : 0,
    };
  })();

  const metrics: Metric[] = [
    {
      label: "Global Rank",
      icon: Award,
      dev1Value: dev1.globalRank.title,
      dev2Value: dev2.globalRank.title,
      higherIsBetter: false,
      format: (v) => String(v),
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Dev Score",
      icon: Star,
      dev1Value: dev1.score,
      dev2Value: dev2.score,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Total Commits",
      icon: GitCommitHorizontal,
      dev1Value: dev1.stats.totalCommits,
      dev2Value: dev2.stats.totalCommits,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Pull Requests",
      icon: GitPullRequest,
      dev1Value: dev1.stats.totalPRs,
      dev2Value: dev2.stats.totalPRs,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Issues Opened",
      icon: CircleDot,
      dev1Value: dev1.stats.totalIssues,
      dev2Value: dev2.stats.totalIssues,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Stars Earned",
      icon: Star,
      dev1Value: dev1.stats.totalStars,
      dev2Value: dev2.stats.totalStars,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Followers",
      icon: Users,
      dev1Value: dev1.stats.followers,
      dev2Value: dev2.stats.followers,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Repositories",
      icon: GitBranch,
      dev1Value: dev1.stats.repos,
      dev2Value: dev2.stats.repos,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Current Streak",
      icon: Flame,
      dev1Value: dev1.stats.streak,
      dev2Value: dev2.stats.streak,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Longest Streak",
      icon: TrendingUp,
      dev1Value: dev1.stats.peakStreak,
      dev2Value: dev2.stats.peakStreak,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Lines Added",
      icon: Code2,
      dev1Value: dev1.stats.linesAdded,
      dev2Value: dev2.stats.linesAdded,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Lines Deleted",
      icon: Code2,
      dev1Value: dev1.stats.linesDeleted,
      dev2Value: dev2.stats.linesDeleted,
      higherIsBetter: false,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
  ];

  const battleMetrics = headToHead ? [
    {
      label: "Battle Wins",
      icon: Trophy,
      dev1Value: headToHead.user1Wins,
      dev2Value: headToHead.user2Wins,
      higherIsBetter: true,
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Total Matches",
      icon: Award,
      dev1Value: headToHead.totalMatches,
      dev2Value: headToHead.totalMatches,
      higherIsBetter: false,
      format: (v: number | string) => String(v),
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Draws",
      icon: Trophy,
      dev1Value: headToHead.draws,
      dev2Value: headToHead.draws,
      higherIsBetter: false,
      format: (v: number | string) => String(v),
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
  ] : null;

  const languageMetrics: Metric[] = [
    {
      label: "Language Overlap",
      icon: Code2,
      dev1Value: `${overlap.percentage}%`,
      dev2Value: `${overlap.percentage}%`,
      higherIsBetter: true,
      format: (v) => String(v),
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
    {
      label: "Shared Languages",
      icon: Code2,
      dev1Value: overlap.shared.length,
      dev2Value: overlap.shared.length,
      higherIsBetter: true,
      format: (v) => String(v),
      dev1Username: dev1.username,
      dev2Username: dev2.username,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/50 overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-zinc-900/50">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-zinc-300">
          <Trophy className="w-4 h-4 text-emerald-400" />
          Side-by-Side Metrics
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-b border-white/5 bg-zinc-900/50">
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400">Metric</th>
              <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-widest text-zinc-400">
                <div className="flex items-center justify-end gap-1">
                  <img src={dev1.avatar} alt="" className="w-5 h-5 rounded-full" />
                  <span>{dev1.username}</span>
                </div>
              </th>
              <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-widest text-zinc-400">Visual</th>
              <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-widest text-zinc-400">Visual</th>
              <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400">
                <div className="flex items-center gap-1">
                  <span>{dev2.username}</span>
                  <img src={dev2.avatar} alt="" className="w-5 h-5 rounded-full" />
                </div>
              </th>
            </tr>
          </thead>
          <MetricSection title="Profile & Ranking" icon={Award}>
            {metrics.slice(0, 2).map((metric, i) => (
              <MetricRow key={i} {...metric} />
            ))}
          </MetricSection>
          <MetricSection title="Contribution Activity" icon={GitCommitHorizontal}>
            {metrics.slice(2, 6).map((metric, i) => (
              <MetricRow key={i + 2} {...metric} />
            ))}
          </MetricSection>
          <MetricSection title="Community & Reach" icon={Users}>
            {metrics.slice(6, 8).map((metric, i) => (
              <MetricRow key={i + 6} {...metric} />
            ))}
          </MetricSection>
          <MetricSection title="Consistency & Streaks" icon={Flame}>
            {metrics.slice(8, 10).map((metric, i) => (
              <MetricRow key={i + 8} {...metric} />
            ))}
          </MetricSection>
          <MetricSection title="Code Volume" icon={Code2}>
            {metrics.slice(10).map((metric, i) => (
              <MetricRow key={i + 10} {...metric} />
            ))}
          </MetricSection>
          {battleMetrics && (
            <MetricSection title="Head-to-Head Battles" icon={Trophy}>
              {battleMetrics.map((metric, i) => (
                <MetricRow key={`battle-${i}`} {...metric} />
              ))}
            </MetricSection>
          )}
          <MetricSection title="Tech Stack Alignment" icon={Code2}>
            {languageMetrics.map((metric, i) => (
              <MetricRow key={`lang-${i}`} {...metric} />
            ))}
          </MetricSection>
        </table>
      </div>

      {overlap.shared.length > 0 && (
        <div className="p-4 border-t border-white/5 bg-zinc-900/30">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-3">
            <Code2 className="w-4 h-4 text-cyan-400" />
            Shared Top Languages
          </div>
          <div className="flex flex-wrap gap-2">
            {overlap.shared.map((lang) => (
              <span
                key={lang.toLowerCase()}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}