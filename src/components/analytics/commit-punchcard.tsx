'use client';

import React, { useState } from 'react';
import { Clock, Calendar, Sparkles } from 'lucide-react';

interface CommitPunchcardProps {
  data?: number[][]; // 7 days x 24 hours
}

export const CommitPunchcard: React.FC<CommitPunchcardProps> = ({ data }) => {
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | 'all'>('30d');
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; count: number } | null>(null);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Generate deterministic punchcard data if not provided
  const matrix = data || days.map((_, dayIndex) =>
    hours.map(hour => {
      // Simulate peak commits in afternoons/evenings
      if (hour >= 18 && hour <= 23 && dayIndex < 5) return ((hour * 3 + dayIndex * 5) % 18) + 2;
      if (hour >= 10 && hour <= 17) return ((hour * 2 + dayIndex * 4) % 10) + 1;
      return (hour + dayIndex) % 3;
    })
  );

  const maxCount = 20;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Commit Punchcard & Productivity Matrix
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hourly commit distribution across days of the week (7 x 24 grid)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Callout */}
      <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>Peak Productivity Window: <strong>Tuesday nights (9:00 PM – 12:00 AM)</strong></span>
        </div>
        {hoveredCell && (
          <div className="font-mono text-foreground font-semibold">
            {hoveredCell.day} at {hoveredCell.hour}:00 — <span className="text-emerald-400">{hoveredCell.count} commits</span>
          </div>
        )}
      </div>

      {/* 7 x 24 Matrix Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[650px] space-y-2">
          {/* Hour labels */}
          <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 text-[10px] font-mono text-muted-foreground text-center">
            <div />
            {hours.map(h => (
              <div key={h}>{h % 3 === 0 ? `${h}h` : ''}</div>
            ))}
          </div>

          {/* Days and Circles */}
          {days.map((day, dIdx) => (
            <div key={day} className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 items-center">
              <span className="text-xs font-semibold text-muted-foreground text-right pr-2">
                {day}
              </span>
              {hours.map(h => {
                const count = matrix[dIdx][h];
                const ratio = Math.min(1, count / maxCount);
                const sizePx = Math.max(4, Math.round(ratio * 16));

                return (
                  <div
                    key={h}
                    onMouseEnter={() => setHoveredCell({ day, hour: h, count })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="h-6 flex items-center justify-center cursor-pointer group"
                  >
                    <div
                      style={{
                        width: `${sizePx}px`,
                        height: `${sizePx}px`,
                        opacity: Math.max(0.2, ratio),
                      }}
                      className="rounded-full bg-primary transition-transform group-hover:scale-125 group-hover:bg-emerald-400 shadow-sm"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
