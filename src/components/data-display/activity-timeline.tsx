"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GitCommit,
  GitPullRequest,
  CircleDot,
  Eye,
  Star,
  GitFork,
  Trophy,
  ArrowUp,
  Filter,
  Search,
  Swords,
  Target,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { Activity } from "@/types";

const activityIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  commit: { icon: GitCommit, color: "text-purple-400", bg: "bg-purple-500/10" },
  pull_request: { icon: GitPullRequest, color: "text-blue-400", bg: "bg-blue-500/10" },
  issue: { icon: CircleDot, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  review: { icon: Eye, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  star: { icon: Star, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  fork: { icon: GitFork, color: "text-orange-400", bg: "bg-orange-500/10" },
  achievement: { icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" },
  level_up: { icon: ArrowUp, color: "text-pink-400", bg: "bg-pink-500/10" },
  battle: { icon: Swords, color: "text-red-400", bg: "bg-red-500/10" },
  challenge: { icon: Target, color: "text-indigo-400", bg: "bg-indigo-500/10" },
};

export type ActivityFilterType = "all" | "battles" | "challenges" | "achievements" | "github" | "commits" | "prs" | "issues";

const filters: { id: ActivityFilterType; label: string }[] = [
  { id: "all", label: "All Events" },
  { id: "battles", label: "Battles" },
  { id: "challenges", label: "Challenges" },
  { id: "achievements", label: "Achievements" },
  { id: "github", label: "GitHub Commits & PRs" },
  { id: "commits", label: "Commits" },
  { id: "prs", label: "PRs" },
  { id: "issues", label: "Issues" },
];

function matchesFilter(activity: Activity, filter: ActivityFilterType): boolean {
  const type = activity.type.toLowerCase();
  switch (filter) {
    case "all": return true;
    case "battles": return type === "battle";
    case "challenges": return type === "challenge";
    case "achievements": return type === "achievement";
    case "github": return type === "commit" || type === "pull_request" || type === "pr";
    case "commits": return type === "commit";
    case "prs": return type === "pull_request" || type === "pr";
    case "issues": return type === "issue";
  }
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function dateHeading(dateString: string, now: Date): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  if (dateKey(date) === dateKey(now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dateKey(date) === dateKey(yesterday)) return "Yesterday";

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  if (date >= weekStart && date < now) return "Earlier this week";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface ActivityTimelineProps {
  activities: Activity[];
  className?: string;
  maxItems?: number;
}

export function ActivityTimeline({
  activities = [],
  className,
  maxItems = 10,
}: ActivityTimelineProps) {
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(maxItems);

  const counts = useMemo(() => Object.fromEntries(
    filters.map(({ id }) => [id, activities.filter((activity) => matchesFilter(activity, id)).length])
  ) as Record<ActivityFilterType, number>, [activities]);

  // Filter activities array in memory
  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activities
      .filter((activity) => matchesFilter(activity, selectedFilter))
      .filter((activity) => !query || [activity.repository, activity.description, activity.title]
        .some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activities, selectedFilter, searchQuery]);

  const displayActivities = filteredActivities.slice(0, visibleCount);
  const now = new Date();

  return (
    <div className={cn("glass-card rounded-[20px] p-6", className)}>
      <div className="flex flex-col gap-3 mb-5">
        <h3 className="text-lg font-semibold text-white">Recent Activity</h3>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Activity filters">
          {filters.map((pill) => {
            const isActive = selectedFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => { setSelectedFilter(pill.id); setVisibleCount(maxItems); }}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white/5 border-transparent text-muted-foreground hover:text-white hover:bg-white/10"
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-slate-400"
                  )}
                >
                  {counts[pill.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="relative block mb-4">
        <span className="sr-only">Search activities</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(maxItems); }}
          placeholder="Search repository or activity"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <div className="space-y-1 relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {displayActivities.length > 0 ? (
            displayActivities.map((activity, index) => {
              const config =
                activityIcons[activity.type.toLowerCase()] || activityIcons.commit;
              const Icon = config.icon;
              const heading = dateHeading(activity.createdAt, now);
              const previousHeading = index > 0 ? dateHeading(displayActivities[index - 1].createdAt, now) : null;

              return (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 25,
                    delay: index * 0.03,
                  }}
                  className="group"
                >
                  {heading !== previousHeading && (
                    <h4 className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h4>
                  )}
                  <div className="flex items-start gap-3 py-3">
                    {/* Icon + Timeline line */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                          config.bg
                        )}
                      >
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      {index < displayActivities.length - 1 && (
                        <div className="w-px h-full bg-white/5 absolute top-10 left-1/2 -translate-x-1/2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {activity.repository && (
                          <span className="text-xs text-primary/80 font-mono bg-primary/5 px-1.5 py-0.5 rounded">
                            {activity.repository}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl bg-white/[0.02] border border-white/5 my-2"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground mb-2.5">
                <Filter className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                No matching activities found
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Try another filter or search term.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {filteredActivities.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 10)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Load More <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
