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
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

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
