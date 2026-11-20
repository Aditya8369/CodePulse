'use client';

import React from 'react';
import { GitCommit, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';

interface ChurnPoint {
  date: string;
  additions: number;
  deletions: number;
  refactoringRatio: number;
}

interface CodeChurnChartProps {
  data: {
    totalAdditions: number;
    totalDeletions: number;
    netCodeGrowth: number;
    overallRefactoringRatio: number;
    churnProfile: 'FEATURE_HEAVY' | 'REFACTORING_BALANCED' | 'CLEANUP_HEAVY';
    timeSeries: ChurnPoint[];
  };
}

export const CodeChurnChart: React.FC<CodeChurnChartProps> = ({ data }) => {
  const maxAdditions = Math.max(...data.timeSeries.map(p => p.additions), 100);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Code Churn & Refactoring Velocity
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Additions (+), Deletions (-), and codebase refactoring health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> +{data.totalAdditions} loc
          </span>
          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> -{data.totalDeletions} loc
          </span>
        </div>
      </div>

      {/* Profile KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[11px] text-muted-foreground">Refactoring Ratio</div>
          <div className="text-lg font-bold text-foreground">
            {(data.overallRefactoringRatio * 100).toFixed(1)}%
          </div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[11px] text-muted-foreground">Net Code Growth</div>
          <div className="text-lg font-bold text-primary">
            {data.netCodeGrowth > 0 ? `+${data.netCodeGrowth}` : data.netCodeGrowth} lines
          </div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="text-[11px] text-muted-foreground">Engineering Style</div>
          <div className="text-xs font-mono font-bold text-amber-400 mt-1">
            {data.churnProfile.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Time-Series Histogram Visualizer */}
      <div className="space-y-3 pt-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Weekly Commit Activity & Volume
        </div>
        <div className="h-44 flex items-end gap-2 border-b border-border/60 pb-2">
          {data.timeSeries.map((point, idx) => {
            const addHeight = Math.min(100, (point.additions / maxAdditions) * 100);
            const delHeight = Math.min(60, (point.deletions / maxAdditions) * 100);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full flex flex-col items-center gap-0.5">
                  <div
                    style={{ height: `${addHeight}px` }}
                    className="w-full max-w-[24px] bg-emerald-500/80 rounded-t group-hover:bg-emerald-400 transition"
                  />
                  <div
                    style={{ height: `${delHeight}px` }}
                    className="w-full max-w-[24px] bg-rose-500/80 rounded-b group-hover:bg-rose-400 transition"
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground truncate w-full text-center">
                  {point.date.slice(5)}
                </span>

                {/* Tooltip on hover */}
                <div className="absolute -top-12 hidden group-hover:flex flex-col items-center bg-popover text-popover-foreground text-[10px] p-1.5 rounded shadow-lg border border-border z-10 whitespace-nowrap">
                  <span>+{point.additions} / -{point.deletions}</span>
                  <span className="text-muted-foreground">Ratio: {(point.refactoringRatio * 100).toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
