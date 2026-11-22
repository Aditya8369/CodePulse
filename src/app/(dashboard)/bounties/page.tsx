'use client';

import React, { useState, useMemo } from 'react';
import {
  Target,
  ExternalLink,
  Sparkles,
  Filter,
  Award,
  Search,
  Lock,
  Unlock,
  ShieldCheck,
  CheckCircle2,
  Coins,
} from 'lucide-react';
import {
  BountyEscrowDrawer,
  BountyItem,
} from '@/components/bounties/bounty-escrow-drawer';
import { cn } from '@/lib/utils';

const INITIAL_BOUNTIES: BountyItem[] = [
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
    escrowTxHash: '0xescrow_7f39b1a09d20c4e1',
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
    escrowTxHash: '0xescrow_90e81c72f10b3a4d',
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
    escrowTxHash: '0xescrow_1189ac302b5e7d99',
  },
  {
    id: 'bty_4',
    repoName: 'CodePulse/realtime',
    issueNumber: 77,
    issueTitle: 'Optimize WebRTC data-channel backpressure buffer drain rate',
    issueUrl: 'https://github.com/CodePulse/realtime/issues/77',
    xpReward: 750,
    sponsorUsername: 'dipak_dev',
    status: 'OPEN',
    tags: ['WebRTC', 'Networking'],
    escrowTxHash: '0xescrow_44a2b9187ce011fc',
  },
];

export default function BountiesPage() {
  const [bounties, setBounties] = useState<BountyItem[]>(INITIAL_BOUNTIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLAIMED'>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'PLEDGE' | 'CLAIM'>('PLEDGE');
  const [activeBounty, setActiveBounty] = useState<BountyItem | null>(null);

  const filteredBounties = useMemo(() => {
    return bounties.filter((b) => {
      const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
      if (!matchStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.issueTitle.toLowerCase().includes(q) ||
        b.repoName.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [bounties, searchQuery, statusFilter]);

  const handleOpenPledge = () => {
    setActiveBounty(null);
    setDrawerMode('PLEDGE');
    setDrawerOpen(true);
  };

  const handleOpenClaim = (bounty: BountyItem) => {
    setActiveBounty(bounty);
    setDrawerMode('CLAIM');
    setDrawerOpen(true);
  };

  const handlePledgeSubmit = (newBounty: {
    repoName: string;
    issueNumber: number;
    issueTitle: string;
    xpReward: number;
    tags: string[];
    escrowTxHash: string;
  }) => {
    const item: BountyItem = {
      id: `bty_${Date.now()}`,
      ...newBounty,
      issueUrl: `https://github.com/${newBounty.repoName}/issues/${newBounty.issueNumber}`,
      sponsorUsername: 'code-with-dipak-777',
      status: 'OPEN',
    };
    setBounties((prev) => [item, ...prev]);
  };

  const handleClaimSubmit = (bountyId: string, prUrl: string, txHash: string) => {
    setBounties((prev) =>
      prev.map((b) =>
        b.id === bountyId
          ? {
              ...b,
              status: 'CLAIMED',
              claimPrUrl: prUrl,
              escrowTxHash: txHash,
              claimantUsername: 'code-with-dipak-777',
            }
          : b
      )
    );
  };

  return (
    <div
      data-testid="bounties-page-container"
      className="container mx-auto py-8 px-4 max-w-5xl space-y-8 text-slate-100"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              TRUSTLESS ESCROW
            </span>
            <span className="text-xs text-slate-400 font-mono">100% On-Chain Guaranteed</span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 mt-1">
            <Target className="h-8 w-8 text-emerald-400" />
            Open Source Issue Bounties
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Solve open GitHub issues, submit merged pull requests, and earn verified escrowed XP rewards.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-place-bounty-btn"
          onClick={handleOpenPledge}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>+ Place Bounty Escrow</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="bounties-search-input"
            placeholder="Search by title, repo, or tech tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
          />
        </div>

        {/* Status Filters */}
        <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer',
              statusFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            All Bounties
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OPEN')}
            className={cn(
              'px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer',
              statusFilter === 'OPEN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Open Escrows
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('CLAIMED')}
            className={cn(
              'px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer',
              statusFilter === 'CLAIMED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            )}
          >
            Claimed
          </button>
        </div>
      </div>

      {/* Bounties Card Grid */}
      <div data-testid="bounties-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBounties.map((bounty) => (
          <div
            key={bounty.id}
            data-testid={`bounty-card-${bounty.id}`}
            className="rounded-2xl border border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl p-6 flex flex-col justify-between shadow-xl hover:border-emerald-500/40 transition-all space-y-4"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="font-semibold text-slate-300">
                  {bounty.repoName} • #{bounty.issueNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 font-mono">
                  +{bounty.xpReward} XP Bounty
                </span>
              </div>

              <h3 className="font-black text-white text-base mt-2 line-clamp-2">
                {bounty.issueTitle}
              </h3>

              {/* Escrow Hash Chip */}
              {bounty.escrowTxHash && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5 w-fit">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="truncate max-w-[200px]">{bounty.escrowTxHash}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-white/5">
              <div className="flex flex-wrap gap-1.5">
                {bounty.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 text-[10px] font-mono font-medium border border-white/5"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">
                  Sponsored by <strong className="text-white">@{bounty.sponsorUsername}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <a
                    href={bounty.issueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white font-semibold transition-colors"
                  >
                    Issue <ExternalLink className="w-3 h-3" />
                  </a>

                  {bounty.status === 'OPEN' ? (
                    <button
                      type="button"
                      data-testid={`claim-bounty-btn-${bounty.id}`}
                      onClick={() => handleOpenClaim(bounty)}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/30 text-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Unlock className="w-3 h-3" /> Claim Bounty
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-cyan-400 text-xs font-mono font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bounty Escrow Pledge & Claim Drawer */}
      <BountyEscrowDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        bounty={activeBounty}
        onPledgeSubmit={handlePledgeSubmit}
        onClaimSubmit={handleClaimSubmit}
      />
    </div>
  );
}
