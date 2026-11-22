"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChallengeFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: string[];
  difficultyFilter: string;
  onDifficultyFilterChange: (value: string) => void;
}

function categoryLabel(category: string) {
  if (category.toUpperCase() === "PRS") return "PRs";
  return category.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: string;
  className?: string;
}) {
  const norm = difficulty.toLowerCase();
  const config =
    norm === "easy"
      ? { symbol: "●", roman: "I", label: "Easy", shape: "circle", color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" }
      : norm === "medium"
      ? { symbol: "◆", roman: "II", label: "Medium", shape: "diamond", color: "text-amber-300 bg-amber-500/15 border-amber-500/30" }
      : norm === "hard"
      ? { symbol: "▲", roman: "III", label: "Hard", shape: "triangle", color: "text-rose-300 bg-rose-500/15 border-rose-500/30" }
      : { symbol: "★", roman: "IV", label: "Legendary", shape: "star", color: "text-purple-300 bg-purple-500/15 border-purple-500/30" };

  return (
    <span
      data-testid={`difficulty-badge-${norm}`}
      data-shape={config.shape}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-sm select-none",
        config.color,
        className
      )}
      title={`${config.label} Difficulty (Tier ${config.roman})`}
    >
      <span
        aria-hidden="true"
        data-testid="difficulty-indicator-shape"
        className="font-bold text-[10px]"
      >
        {config.symbol}
      </span>
      <span>{config.label}</span>
      <span className="text-[10px] opacity-75 font-mono">[{config.roman}]</span>
    </span>
  );
}

export function ChallengeFilterBar({
  searchInput,
  onSearchInputChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  difficultyFilter,
  onDifficultyFilterChange,
}: ChallengeFilterBarProps) {
  return (
    <div className="space-y-3" aria-label="Search and filter challenges">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search challenges"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search challenges"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear challenge search"
              onClick={() => onSearchInputChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          aria-label="Filter challenges by difficulty"
          value={difficultyFilter}
          onChange={(event) => onDifficultyFilterChange(event.target.value)}
          className="h-10 rounded-xl border border-white/10 bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy (●)</option>
          <option value="medium">Medium (◆)</option>
          <option value="hard">Hard (▲)</option>
        </select>
      </div>

      {/* Color-Blind Safe Difficulty Indicator Badges */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label="Filter challenges by difficulty tags">
        <span className="text-xs text-muted-foreground mr-1">Difficulty:</span>
        {[
          { id: "all", label: "All", symbol: "✦" },
          { id: "easy", label: "Easy", symbol: "●", roman: "I" },
          { id: "medium", label: "Medium", symbol: "◆", roman: "II" },
          { id: "hard", label: "Hard", symbol: "▲", roman: "III" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`filter-difficulty-${item.id}`}
            aria-pressed={difficultyFilter === item.id}
            onClick={() => onDifficultyFilterChange(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
              difficultyFilter === item.id
                ? "border-primary/50 bg-primary/20 text-white shadow-sm font-semibold"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white"
            )}
          >
            <span aria-hidden="true" className="text-[10px] font-bold">{item.symbol}</span>
            <span>{item.label}</span>
            {item.roman && <span className="text-[10px] opacity-60 font-mono">[{item.roman}]</span>}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter challenges by category">
        {["all", ...categories].map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={categoryFilter === category}
            onClick={() => onCategoryFilterChange(category)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              categoryFilter === category
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
            )}
          >
            {category === "all" ? "All categories" : categoryLabel(category)}
          </button>
        ))}
      </div>
    </div>
  );
}
