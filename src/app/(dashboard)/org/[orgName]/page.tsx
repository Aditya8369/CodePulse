'use client';

import React from 'react';
import { Users, GitFork, GitCommit, Trophy, Star, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { OrgMetricCard } from '@/components/cards/org-metric-card';

export default function OrgAnalyticsPage({ params }: { params: { orgName: string } }) {
  const orgName = params.orgName || 'nexus-org';

  const mockOrg = {
    name: orgName,
    members: 48,
    repositories: 19,
    monthlyCommits: 1240,
    velocityScore: 92,
    topRepos: [
      { name: 'core-platform', stars: 480, forks: 92, velocity: 94, lang: 'TypeScript' },
      { name: 'developer-hub', stars: 320, forks: 64, velocity: 88, lang: 'React' },
      { name: 'cloud-infra', stars: 140, forks: 18, velocity: 76, lang: 'Go' },
    ],
    podium: [
      { rank: 1, name: 'Alex Mercer', username: 'alexmercer', score: 2450, commits: 142 },
      { rank: 2, name: 'Sarah Chen', username: 'sarah_dev', score: 2180, commits: 118 },
      { rank: 3, name: 'Kevin Durant', username: 'kevin_go', score: 1920, commits: 96 },
    ],
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-primary-foreground font-black text-2xl shadow-lg">
            {orgName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{orgName}</h1>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                Verified Organization
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cross-team engineering velocity and collaborative repository leaderboard
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OrgMetricCard
          title="Engineers & Contributors"
          value={mockOrg.members}
          icon={Users}
          badge="+6 this month"
          badgeColor="emerald"
        />
        <OrgMetricCard
          title="Active Repositories"
          value={mockOrg.repositories}
          icon={GitFork}
        />
        <OrgMetricCard
          title="Monthly Commits"
          value={mockOrg.monthlyCommits}
          icon={GitCommit}
          badge="Top 5% Org"
          badgeColor="primary"
        />
        <OrgMetricCard
          title="Team Velocity Index"
          value={`${mockOrg.velocityScore} / 100`}
          icon={ShieldCheck}
          badge="High Velocity"
          badgeColor="emerald"
        />
      </div>

      {/* 2-Column Split: Top Repos & Internal Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Repositories */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            High Velocity Repositories
          </h2>
          <div className="space-y-3">
            {mockOrg.topRepos.map(repo => (
              <div
                key={repo.name}
                className="p-4 rounded-lg bg-background/50 border border-border/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                    {repo.name}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {repo.lang}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    <span>★ {repo.stars} stars</span>
                    <span>⑂ {repo.forks} forks</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {repo.velocity} Velocity
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Internal Leaderboard Podium */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Internal Contributor Podium
          </h2>
          <div className="space-y-3">
            {mockOrg.podium.map(contributor => (
              <div
                key={contributor.username}
                className="p-4 rounded-lg bg-background/50 border border-border/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      contributor.rank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : contributor.rank === 2
                        ? 'bg-slate-300 text-slate-950'
                        : 'bg-amber-700 text-white'
                    }`}
                  >
                    #{contributor.rank}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{contributor.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">@{contributor.username}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-foreground">{contributor.score} XP</div>
                  <div className="text-[11px] text-muted-foreground">{contributor.commits} commits</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
