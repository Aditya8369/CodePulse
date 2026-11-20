'use client';

import React, { useState } from 'react';
import { Target, ExternalLink, Sparkles, Filter, Award } from 'lucide-react';

export default function BountiesPage() {
  const [bounties] = useState([
    {
      id: 'bty_1',
      repoName: 'CodePulse/core',
      issueNumber: 42,
      issueTitle: 'Implement zero-copy JSON parser for battle webhooks',
      issueUrl: 'https://github.com/CodePulse/core/issues/42',
      xpReward: 350,
      sponsorUsername: 'alexmercer',
      status: 'OPEN',
      tags: ['Rust', 'Performance'],
    },
    {
      id: 'bty_2',
      repoName: 'CodePulse/web',
      issueNumber: 108,
      issueTitle: 'Refactor chart components with virtualized canvas rendering',
      issueUrl: 'https://github.com/CodePulse/web/issues/108',
      xpReward: 500,
      sponsorUsername: 'sarah_dev',
      status: 'OPEN',
      tags: ['TypeScript', 'Next.js'],
    },
    {
      id: 'bty_3',
      repoName: 'CodePulse/infra',
      issueNumber: 19,
      issueTitle: 'Configure automated Prometheus alertmanager rules for DLQ',
      issueUrl: 'https://github.com/CodePulse/infra/issues/19',
      xpReward: 250,
      sponsorUsername: 'kevin_go',
      status: 'OPEN',
      tags: ['DevOps', 'Kubernetes'],
    },
  ]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Open Source Issue Bounties
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Solve open GitHub issues, submit merged pull requests, and earn escrowed XP rewards.
          </p>
        </div>

        <button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow">
          + Place Bounty
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bounties.map(bounty => (
          <div
            key={bounty.id}
            className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm hover:border-primary/40 transition space-y-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>{bounty.repoName} • #{bounty.issueNumber}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  +{bounty.xpReward} XP Bounty
                </span>
              </div>

              <h3 className="font-bold text-foreground text-base mt-2 line-clamp-2">
                {bounty.issueTitle}
              </h3>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/40">
              <div className="flex flex-wrap gap-1.5">
                {bounty.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] font-mono font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground">
                  Sponsored by <strong className="text-foreground">@{bounty.sponsorUsername}</strong>
                </span>
                <a
                  href={bounty.issueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  View on GitHub <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
