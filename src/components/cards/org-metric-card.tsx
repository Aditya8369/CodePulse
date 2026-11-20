'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface OrgMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: 'emerald' | 'primary' | 'amber';
}

export const OrgMetricCard: React.FC<OrgMetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor = 'primary',
}) => {
  const badgeClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }[badgeColor];

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground/80 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
};
