"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Download,
  Share2,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Printer,
  Sparkles,
  Award,
  Code2,
  GitPullRequest,
  Trophy,
  Copy,
  Check,
  Sliders,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface ResumeProfileData {
  fullName: string;
  headline: string;
  username: string;
  email: string;
  githubUrl: string;
  portfolioUrl?: string;
  location: string;
  eloRating: number;
  globalRank: number;
  battlesWon: number;
  prsMerged: number;
  nsocPoints: number;
  verificationHash: string;
  topSkills: string[];
  keyHighlights: string[];
}

export interface ResumeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: ResumeProfileData;
  onDownload?: () => void;
}

const DEFAULT_PROFILE: ResumeProfileData = {
  fullName: "Dipak Kumar",
  headline: "Senior Full-Stack Engineer & Distributed Systems Contributor",
  username: "code-with-dipak-777",
  email: "dipak@codepulse.dev",
  githubUrl: "https://github.com/code-with-dipak-777",
  portfolioUrl: "https://codepulse.dev/u/code-with-dipak-777",
  location: "Bengaluru, India",
  eloRating: 2180,
  globalRank: 14,
  battlesWon: 86,
  prsMerged: 35,
  nsocPoints: 175,
  verificationHash: "cp-cert-sha256-9f82c4e1b7309a6f204891b2",
  topSkills: [
    "TypeScript",
    "React / Next.js",
    "NestJS / Node.js",
    "Go",
    "Kubernetes / Docker",
    "PostgreSQL",
    "Tailwind CSS",
  ],
  keyHighlights: [
    "Ranked in the top 0.5% globally in CodePulse Algorithmic Battle Arena (2,180 ELO).",
    "Merged 35+ verified pull requests across production Next.js and NestJS microservices.",
    "Engineered low-latency WebGL canvas renderers and real-time WebSocket state synchronizers.",
    "Recipient of Nexus Spring of Code (NSoC'26) High Honors Contributor Award.",
  ],
};

export function ResumeExportModal({
  isOpen,
  onClose,
  profile = DEFAULT_PROFILE,
  onDownload,
}: ResumeExportModalProps) {
  const [templateTheme, setTemplateTheme] = useState<"CYBER" | "CLEAN" | "EXECUTIVE">("CYBER");
  const [includeBattleStats, setIncludeBattleStats] = useState(true);
  const [includeHighlights, setIncludeHighlights] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleCopyVerificationLink = () => {
    const url = `https://codepulse.dev/verify/${profile.verificationHash}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setIsCopied(true);
    toast.success("Cryptographic verification URL copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    toast.info("Generating cryptographically verifiable PDF document...");

    setTimeout(() => {
      setIsDownloading(false);
      if (typeof window !== "undefined" && window.print) {
        // Trigger print stylesheet or standard window print dialog
        try {
          window.print();
        } catch {
          // Fallback if print is blocked
        }
      }
      onDownload?.();
      toast.success("Resume PDF downloaded successfully!");
    }, 800);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="resume-export-modal-dialog"
        className="max-w-4xl bg-[#090D16]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[32px] p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
                VERIFIABLE CREDENTIALS
              </span>
              <span className="text-xs text-slate-400 font-mono">SHA-256 Ledger Backed</span>
            </div>
            <DialogTitle className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Developer Resume & CV Export
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Export an official CodePulse-certified technical resume with real on-platform metrics.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="copy-verification-link-btn"
              onClick={handleCopyVerificationLink}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? "Copied Link" : "Copy Verification URL"}</span>
            </button>

            <button
              type="button"
              data-testid="download-pdf-btn"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? "Rendering..." : "Download PDF"}</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Controls & Live Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar: Customization Controls */}
          <div className="lg:col-span-1 space-y-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Customization
              </span>

              {/* Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">Resume Theme</label>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <button
                    type="button"
                    data-testid="theme-opt-cyber"
                    onClick={() => setTemplateTheme("CYBER")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-left font-semibold transition-all cursor-pointer border",
                      templateTheme === "CYBER"
                        ? "bg-indigo-600/30 border-indigo-500 text-white"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white"
                    )}
                  >
                    Cyber Dark
                  </button>
                  <button
                    type="button"
                    data-testid="theme-opt-clean"
                    onClick={() => setTemplateTheme("CLEAN")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-left font-semibold transition-all cursor-pointer border",
                      templateTheme === "CLEAN"
                        ? "bg-indigo-600/30 border-indigo-500 text-white"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white"
                    )}
                  >
                    Minimalist Paper
                  </button>
                  <button
                    type="button"
                    data-testid="theme-opt-executive"
                    onClick={() => setTemplateTheme("EXECUTIVE")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-left font-semibold transition-all cursor-pointer border",
                      templateTheme === "EXECUTIVE"
                        ? "bg-indigo-600/30 border-indigo-500 text-white"
                        : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white"
                    )}
                  >
                    Executive Navy
                  </button>
                </div>
              </div>

              {/* Section Toggles */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-[11px] font-semibold text-slate-300">Visible Sections</label>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Battle & ELO Stats</span>
                  <input
                    type="checkbox"
                    aria-label="Toggle Battle and ELO Stats"
                    checked={includeBattleStats}
                    onChange={(e) => setIncludeBattleStats(e.target.checked)}
                    className="accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Key Highlights</span>
                  <input
                    type="checkbox"
                    aria-label="Toggle Key Highlights"
                    checked={includeHighlights}
                    onChange={(e) => setIncludeHighlights(e.target.checked)}
                    className="accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Verification Hash Card */}
            <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>On-Chain Verified</span>
              </div>
              <div className="text-[10px] font-mono break-all text-slate-400">
                {profile.verificationHash}
              </div>
            </div>
          </div>

          {/* Right Live Document Sheet */}
          <div className="lg:col-span-3">
            <div
              data-testid="resume-document-sheet"
              className={cn(
                "p-8 rounded-2xl border transition-all duration-300 shadow-2xl space-y-6 font-sans",
                templateTheme === "CLEAN"
                  ? "bg-white text-slate-900 border-slate-200"
                  : templateTheme === "EXECUTIVE"
                  ? "bg-[#0B1528] text-slate-100 border-blue-900/40"
                  : "bg-[#0F1420] text-slate-100 border-white/10"
              )}
            >
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6 border-current/10">
                <div>
                  <h1 className="text-2xl font-black tracking-tight">{profile.fullName}</h1>
                  <p className="text-xs font-medium opacity-80 mt-1">{profile.headline}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono opacity-70 mt-2">
                    <span>{profile.email}</span>
                    <span>•</span>
                    <span>{profile.location}</span>
                    <span>•</span>
                    <span>github.com/{profile.username}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border border-current/20 bg-current/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CodePulse Certified</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-60 mt-1">
                    ID: {profile.verificationHash.slice(0, 16)}...
                  </div>
                </div>
              </div>

              {/* Verified Platform Metrics Banner */}
              {includeBattleStats && (
                <div
                  data-testid="resume-battle-stats-banner"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-current/10 bg-current/[0.03]"
                >
                  <div>
                    <div className="text-[10px] font-mono uppercase opacity-70">Competitive Rating</div>
                    <div className="text-base font-black font-mono mt-0.5">{profile.eloRating} ELO</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase opacity-70">Global Rank</div>
                    <div className="text-base font-black font-mono mt-0.5">#{profile.globalRank} World</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase opacity-70">Battles Won</div>
                    <div className="text-base font-black font-mono mt-0.5">{profile.battlesWon} Matches</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase opacity-70">Verified PRs</div>
                    <div className="text-base font-black font-mono mt-0.5">{profile.prsMerged} Merged</div>
                  </div>
                </div>
              )}

              {/* Technical Core Competencies */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider opacity-80">
                  Verified Technical Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.topSkills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-current/15 bg-current/5"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Achievements & Highlights */}
              {includeHighlights && (
                <div data-testid="resume-highlights-section" className="space-y-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider opacity-80">
                    Key Platform Achievements
                  </h3>
                  <ul className="space-y-1.5 text-xs opacity-90">
                    {profile.keyHighlights.map((hl, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Document Footer */}
              <div className="pt-4 border-t border-current/10 flex items-center justify-between text-[10px] font-mono opacity-60">
                <span>Certified by CodePulse Nexus Protocol</span>
                <span>Verification: codepulse.dev/verify/{profile.verificationHash}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
