'use client';

import React, { useEffect, useState } from 'react';
import { Award, Zap, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LevelProgressionRingProps {
  currentLevel?: number;
  currentXp?: number;
  xpToNextLevel?: number;
  tierName?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  eloRating?: number;
  eloChange?: number;
  size?: number;
  animate?: boolean;
}

export function useCountUp(
  target: number,
  duration: number = 750,
  animate: boolean = true
): number {
  const [val, setVal] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      setVal(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const startVal = 0;

    const tick = (now: number) => {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setVal(Math.round(startVal + (target - startVal) * eased));
      if (elapsed < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, animate]);

  return val;
}

export const LevelProgressionRing: React.FC<LevelProgressionRingProps> = ({
  currentLevel = 14,
  currentXp = 760,
  xpToNextLevel = 1000,
  tierName = 'Platinum',
  eloRating = 1480,
  eloChange,
  size = 140,
  animate = true,
}) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated Count-Up Numbers
  const animatedXp = useCountUp(currentXp, 800, animate);
  const animatedElo = useCountUp(eloRating, 850, animate);
  const animatedLevel = useCountUp(currentLevel, 600, animate);

  const progressPercent = Math.min(
    100,
    Math.round((animatedXp / (xpToNextLevel || 1)) * 100)
  );
  const strokeDashoffset =
    circumference - (progressPercent / 100) * circumference;

  const tierColors = {
    Bronze: 'from-amber-700 to-amber-900 text-amber-600',
    Silver: 'from-slate-400 to-slate-600 text-slate-300',
    Gold: 'from-amber-400 to-yellow-600 text-amber-400',
    Platinum: 'from-cyan-400 to-blue-600 text-cyan-400',
    Diamond: 'from-purple-400 to-pink-600 text-purple-400',
  }[tierName] || 'from-cyan-400 to-blue-600 text-cyan-400';

  return (
    <div
      data-testid="level-progression-ring"
      className="flex flex-col items-center p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm relative group"
    >
      {/* Level Ring SVG */}
      <div className="relative flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="text-muted/30"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="text-primary transition-all duration-300 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>

        {/* Center Badge Content */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Level
          </span>
          <span
            data-testid="animated-level"
            className="text-3xl font-black text-foreground"
          >
            {animatedLevel}
          </span>
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              tierColors.split(' ')[2]
            )}
          >
            {tierName}
          </span>
        </div>
      </div>

      {/* Animated XP Numbers */}
      <div className="mt-4 text-center space-y-1">
        <div
          data-testid="animated-xp-counter"
          className="text-xs font-semibold text-foreground flex items-center justify-center gap-1"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span>
            {animatedXp} / {xpToNextLevel} XP ({progressPercent}%)
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {Math.max(0, xpToNextLevel - animatedXp)} XP needed for Level{' '}
          {currentLevel + 1}
        </p>
      </div>

      {/* Elo Rating and Changes Display */}
      {eloRating > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 w-full flex items-center justify-between px-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground font-medium">Elo Rating:</span>
            <span
              data-testid="animated-elo-counter"
              className="font-bold text-foreground"
            >
              {animatedElo}
            </span>
          </div>

          {eloChange !== undefined && (
            <div
              data-testid="elo-change-badge"
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
                eloChange >= 0
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              )}
            >
              {eloChange >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>
                {eloChange >= 0 ? `+${eloChange}` : eloChange}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
