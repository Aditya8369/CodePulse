'use client';

import React from 'react';
import { Award, Zap, Sparkles } from 'lucide-react';

interface LevelProgressionRingProps {
  currentLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  tierName?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  size?: number;
}

export const LevelProgressionRing: React.FC<LevelProgressionRingProps> = ({
  currentLevel = 14,
  currentXp = 760,
  xpToNextLevel = 1000,
  tierName = 'Platinum',
  size = 140,
}) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = Math.min(100, Math.round((currentXp / xpToNextLevel) * 100));
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const tierColors = {
    Bronze: 'from-amber-700 to-amber-900 text-amber-600',
    Silver: 'from-slate-400 to-slate-600 text-slate-300',
    Gold: 'from-amber-400 to-yellow-600 text-amber-400',
    Platinum: 'from-cyan-400 to-blue-600 text-cyan-400',
    Diamond: 'from-purple-400 to-pink-600 text-purple-400',
  }[tierName];

  return (
    <div className="flex flex-col items-center p-6 rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm relative group">
      {/* Level Ring SVG */}
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
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
            className="text-primary transition-all duration-1000 ease-out"
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
          <span className="text-3xl font-black text-foreground">{currentLevel}</span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${tierColors.split(' ')[2]}`}>
            {tierName}
          </span>
        </div>
      </div>

      <div className="mt-4 text-center space-y-1">
        <div className="text-xs font-semibold text-foreground">
          {currentXp} / {xpToNextLevel} XP ({progressPercent}%)
        </div>
        <p className="text-[11px] text-muted-foreground">
          {xpToNextLevel - currentXp} XP needed for Level {currentLevel + 1}
        </p>
      </div>
    </div>
  );
};
