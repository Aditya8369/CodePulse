"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Lock,
  Unlock,
  Coins,
  ExternalLink,
  GitPullRequest,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BountyItem {
  id: string;
  repoName: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  xpReward: number;
  sponsorUsername: string;
  status: "OPEN" | "CLAIMED" | "RELEASED";
  tags: string[];
  escrowTxHash?: string;
  claimantUsername?: string;
  claimPrUrl?: string;
}

export interface BountyEscrowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "PLEDGE" | "CLAIM";
  bounty?: BountyItem | null;
  onPledgeSubmit?: (pledgeData: {
    repoName: string;
    issueNumber: number;
    issueTitle: string;
    xpReward: number;
    tags: string[];
    escrowTxHash: string;
  }) => void;
  onClaimSubmit?: (bountyId: string, prUrl: string, txHash: string) => void;
}

export function BountyEscrowDrawer({
  isOpen,
  onClose,
  mode,
  bounty,
  onPledgeSubmit,
  onClaimSubmit,
}: BountyEscrowDrawerProps) {
  // Pledge form state
  const [pledgeRepo, setPledgeRepo] = useState("CodePulse/core");
  const [pledgeIssueNum, setPledgeIssueNum] = useState<number>(45);
  const [pledgeTitle, setPledgeTitle] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState<number>(500);
  const [pledgeTags, setPledgeTags] = useState("TypeScript, Performance");

  // Claim form state
  const [claimPrUrl, setClaimPrUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const activeTxHash =
    bounty?.escrowTxHash ||
    `0xescrow_${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16).substring(4)}`;

  const handleCopyTx = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(activeTxHash);
    }
    setCopiedHash(true);
    toast.success("Escrow transaction hash copied to clipboard!");
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handlePledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeTitle.trim()) {
      toast.error("Please enter a title for the bounty issue.");
      return;
    }

    setIsSubmitting(true);
    const generatedHash = `0xescrow_${Math.random().toString(16).substring(2, 12)}`;

    setTimeout(() => {
      setIsSubmitting(false);
      const parsedTags = pledgeTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      onPledgeSubmit?.({
        repoName: pledgeRepo,
        issueNumber: pledgeIssueNum,
        issueTitle: pledgeTitle,
        xpReward: pledgeAmount,
        tags: parsedTags.length > 0 ? parsedTags : ["Bugfix", "Feature"],
        escrowTxHash: generatedHash,
      });

      toast.success(`Escrow Locked: +${pledgeAmount} XP Bounty Created!`, {
        description: `Tx: ${generatedHash.slice(0, 18)}...`,
      });
      onClose();
    }, 600);
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimPrUrl.trim()) {
      toast.error("Please enter your merged Pull Request URL.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (bounty) {
        onClaimSubmit?.(bounty.id, claimPrUrl, activeTxHash);
      }
      toast.success("Bounty Claim Submitted for Escrow Release!", {
        description: `Proof submitted under tx ${activeTxHash.slice(0, 16)}...`,
      });
      onClose();
    }, 600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="bounty-escrow-drawer-wrapper"
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
        >
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Drawer Sheet */}
          <motion.div
            data-testid="bounty-escrow-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative z-10 w-full max-w-md h-full bg-[#0B0F19] border-l border-white/10 text-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {mode === "PLEDGE" ? "Lock Bounty Escrow Pledge" : "Claim & Review Escrow Bounty"}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      Nexus Trustless Escrow Protocol
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="close-drawer-btn"
                  onClick={onClose}
                  className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Transaction Hash Banner */}
              <div className="mt-4 p-3 rounded-2xl border border-white/10 bg-white/[0.03] space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Escrow Smart Lock Hash
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTx}
                    className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div
                  data-testid="escrow-tx-hash-display"
                  className="text-xs font-mono font-bold text-cyan-300 break-all select-all"
                >
                  {activeTxHash}
                </div>
              </div>

              {/* Mode-Specific Body */}
              {mode === "PLEDGE" ? (
                /* Mode 1: Pledge Form */
                <form onSubmit={handlePledge} className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Repository & Issue
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={pledgeRepo}
                        onChange={(e) => setPledgeRepo(e.target.value)}
                        placeholder="Owner/Repo"
                        className="col-span-2 px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500 font-mono"
                      />
                      <input
                        type="number"
                        value={pledgeIssueNum}
                        onChange={(e) => setPledgeIssueNum(Number(e.target.value))}
                        placeholder="#No"
                        className="px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Issue Title / Objective
                    </label>
                    <input
                      type="text"
                      data-testid="pledge-title-input"
                      value={pledgeTitle}
                      onChange={(e) => setPledgeTitle(e.target.value)}
                      placeholder="e.g. Implement WebRTC Rollback Netcode Buffer"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Escrow XP Bounty Pledge
                    </label>
                    <div className="flex items-center gap-2">
                      {[250, 500, 1000, 2500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPledgeAmount(amt)}
                          className={cn(
                            "flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer",
                            pledgeAmount === amt
                              ? "bg-amber-500 text-black border-amber-400"
                              : "bg-white/[0.02] border-white/10 text-slate-300 hover:text-white"
                          )}
                        >
                          +{amt} XP
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={pledgeTags}
                      onChange={(e) => setPledgeTags(e.target.value)}
                      placeholder="Next.js, WebGL, Performance"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="submit-pledge-btn"
                    disabled={isSubmitting}
                    className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "Locking In Escrow..." : `Lock +${pledgeAmount} XP Bounty`}</span>
                  </button>
                </form>
              ) : (
                /* Mode 2: Claim Review Form */
                <form onSubmit={handleClaim} className="mt-6 space-y-4">
                  {bounty && (
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>{bounty.repoName} • #{bounty.issueNumber}</span>
                        <span className="text-amber-400 font-bold">+{bounty.xpReward} XP</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{bounty.issueTitle}</h4>
                      <p className="text-[11px] text-slate-400">
                        Sponsored by @{bounty.sponsorUsername}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Merged Pull Request URL
                    </label>
                    <input
                      type="url"
                      data-testid="claim-pr-url-input"
                      value={claimPrUrl}
                      onChange={(e) => setClaimPrUrl(e.target.value)}
                      placeholder="https://github.com/CodePulse/core/pull/123"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-indigo-300 text-xs space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Automated Verification
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Once submitted, the CodePulse verification engine verifies commit signatures, test pass rates, and pull request merge status to release the escrow.
                    </p>
                  </div>

                  <button
                    type="submit"
                    data-testid="submit-claim-btn"
                    disabled={isSubmitting}
                    className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? "Verifying Proof..." : "Submit Claim for Release"}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Drawer Footer Notice */}
            <div className="pt-4 border-t border-white/10 text-[10px] font-mono text-slate-500 flex items-center justify-between">
              <span>CodePulse Escrow Vault v2</span>
              <span>Gasless Relayer</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
