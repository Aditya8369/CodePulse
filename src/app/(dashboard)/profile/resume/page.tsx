"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  ChevronLeft,
  Code2,
  Copy,
  Download,
  Eye,
  FileText,
  FolderGit2,
  HelpCircle,
  Layout,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trophy,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/api/use-auth";
import {
  ResumePreview,
  ResumeData,
  ResumeCustomizerOptions,
  ResumeFont,
  ResumeSpacing,
  ResumeTheme,
  DEFAULT_RESUME_DATA,
  DEFAULT_CUSTOMIZER_OPTIONS,
} from "@/components/profile/resume-preview";

export default function ResumeBuilderPage() {
  const { data: user } = useCurrentUser();
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize resume data using logged in user info with comprehensive fallbacks
  const [resumeData, setResumeData] = useState<ResumeData>(() => {
    return {
      ...DEFAULT_RESUME_DATA,
      fullName: user?.name || DEFAULT_RESUME_DATA.fullName,
      email: user?.email || user?.authEmail || DEFAULT_RESUME_DATA.email,
      username: user?.username || DEFAULT_RESUME_DATA.username,
      location: user?.location || DEFAULT_RESUME_DATA.location,
      githubUrl: user?.githubUrl || (user?.username ? `https://github.com/${user.username}` : DEFAULT_RESUME_DATA.githubUrl),
      headline: user?.bio || DEFAULT_RESUME_DATA.headline,
      eloRating: user?.rating?.overall || DEFAULT_RESUME_DATA.eloRating,
      tier: user?.rating?.tier || DEFAULT_RESUME_DATA.tier,
      totalStars: user?.stats?.totalStars || DEFAULT_RESUME_DATA.totalStars,
      totalPrs: user?.stats?.totalPRs || DEFAULT_RESUME_DATA.totalPrs,
      totalCommits: user?.stats?.totalCommits || DEFAULT_RESUME_DATA.totalCommits,
    };
  });

  const [options, setOptions] = useState<ResumeCustomizerOptions>(DEFAULT_CUSTOMIZER_OPTIONS);
  const [activeTab, setActiveTab] = useState<"layout" | "content" | "sections">("layout");
  const [isCopied, setIsCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Handle Download PDF via browser print pipeline
  const handleDownloadPdf = () => {
    setIsPrinting(true);
    toast.info("Preparing ATS-optimized printable resume document...");

    setTimeout(() => {
      setIsPrinting(false);
      if (typeof window !== "undefined") {
        try {
          window.print();
          toast.success("Print dialog opened. Select 'Save as PDF' for an ATS-optimized file!");
        } catch {
          toast.error("Unable to open print dialog directly.");
        }
      }
    }, 400);
  };

  // Handle Copy Public Resume Link
  const handleCopyResumeLink = () => {
    const link = `https://codepulse.dev/resume/${resumeData.username || "dev"}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
    }
    setIsCopied(true);
    toast.success("Public resume link copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleResetDefaults = () => {
    setOptions(DEFAULT_CUSTOMIZER_OPTIONS);
    setResumeData(DEFAULT_RESUME_DATA);
    toast.info("Customizer reset to standard ATS defaults.");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Print Stylesheet Overrides */}
      <style>{`
        @media print {
          @page {
            size: letter;
            margin: 0.4in;
          }
          body {
            background: #ffffff !important;
            color: #111827 !important;
          }
          /* Hide all application shells, navigation, topbars, sidebars, and control panels */
          aside,
          nav,
          header,
          .topbar,
          .sidebar,
          .no-print,
          .customizer-panel,
          button {
            display: none !important;
          }
          /* Clean resume canvas */
          .resume-sheet {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
          }
          .page-break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Top Header & Breadcrumbs / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
            <Link
              href="/profile"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Profile
            </Link>
            <span>/</span>
            <span className="text-indigo-400">Resume & CV Builder</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-400" />
            Developer Resume Builder
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generate an ATS-friendly, single-page technical resume backed by your verified GitHub and CodePulse competitive metrics.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            data-testid="copy-public-resume-link-btn"
            onClick={handleCopyResumeLink}
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? "Link Copied!" : "Copy Public Link"}</span>
          </button>

          <button
            type="button"
            data-testid="download-pdf-resume-btn"
            onClick={handleDownloadPdf}
            disabled={isPrinting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isPrinting ? "Formatting PDF..." : "Download PDF"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Customizer Controls vs Right Live Sheet Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: Interactive Customizer Controls                        */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-5 no-print customizer-panel">
          <div className="glass-card rounded-[24px] border border-white/10 p-5 space-y-5 bg-black/40 backdrop-blur-xl">
            {/* Customizer Subtabs */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold">
              <button
                type="button"
                data-testid="tab-layout"
                onClick={() => setActiveTab("layout")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  activeTab === "layout"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Layout & Fonts</span>
              </button>
              <button
                type="button"
                data-testid="tab-sections"
                onClick={() => setActiveTab("sections")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  activeTab === "sections"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Sections</span>
              </button>
              <button
                type="button"
                data-testid="tab-content"
                onClick={() => setActiveTab("content")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  activeTab === "content"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Content</span>
              </button>
            </div>

            {/* TAB 1: Layout, Typography & Theme */}
            {activeTab === "layout" && (
              <div className="space-y-4">
                {/* Font Family Choice */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Typography Font</span>
                    <span className="text-[10px] font-mono text-slate-500">ATS Optimized</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(["Inter", "Roboto", "JetBrains Mono"] as ResumeFont[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        data-testid={`font-option-${f.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => setOptions((prev) => ({ ...prev, font: f }))}
                        className={cn(
                          "px-2.5 py-2 rounded-xl border text-center font-medium transition-all cursor-pointer",
                          options.font === f
                            ? "border-indigo-500 bg-indigo-500/20 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spacing / Density Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Page Spacing Density</span>
                    <span className="text-[10px] font-mono text-slate-500">Single Page Fit</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      data-testid="spacing-compact-btn"
                      onClick={() => setOptions((prev) => ({ ...prev, spacing: "compact" }))}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-left font-medium transition-all cursor-pointer",
                        options.spacing === "compact"
                          ? "border-indigo-500 bg-indigo-500/20 text-white font-bold"
                          : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="font-bold text-current">Compact (1-Page)</div>
                      <div className="text-[10px] text-slate-400">Fits on standard single Letter/A4</div>
                    </button>
                    <button
                      type="button"
                      data-testid="spacing-detailed-btn"
                      onClick={() => setOptions((prev) => ({ ...prev, spacing: "detailed" }))}
                      className={cn(
                        "px-3 py-2 rounded-xl border text-left font-medium transition-all cursor-pointer",
                        options.spacing === "detailed"
                          ? "border-indigo-500 bg-indigo-500/20 text-white font-bold"
                          : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <div className="font-bold text-current">Detailed</div>
                      <div className="text-[10px] text-slate-400">Expanded line height and padding</div>
                    </button>
                  </div>
                </div>

                {/* Theme Selector for Screen Preview */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Preview Palette</span>
                    <span className="text-[10px] font-mono text-slate-500">Print is always clean white</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { id: "ats-clean", label: "ATS Paper" },
                      { id: "modern-dark", label: "Cyber Dark" },
                      { id: "executive-navy", label: "Executive" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        data-testid={`theme-option-${t.id}`}
                        onClick={() =>
                          setOptions((prev) => ({ ...prev, theme: t.id as ResumeTheme }))
                        }
                        className={cn(
                          "px-2.5 py-2 rounded-xl border text-center font-medium transition-all cursor-pointer",
                          options.theme === t.id
                            ? "border-indigo-500 bg-indigo-500/20 text-white font-bold"
                            : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Sections & Toggles */}
            {activeTab === "sections" && (
              <div className="space-y-3.5">
                <span className="text-xs font-semibold text-slate-300">Include or Hide Sections</span>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span>CodePulse Competitive ELO Rating</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-elo-rating"
                      checked={options.includeEloRating}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeEloRating: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-indigo-400" />
                      <span>Top GitHub Projects</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-projects"
                      checked={options.includeProjects}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeProjects: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>GitHub Aggregate Metrics (Stars / Commits)</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-github-stats"
                      checked={options.includeGithubStats}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeGithubStats: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>Tech Stack Radar & Competencies</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-skills"
                      checked={options.includeSkills}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeSkills: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Key Honors & Achievements</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-achievements"
                      checked={options.includeAchievements}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeAchievements: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Professional Experience</span>
                    </span>
                    <input
                      type="checkbox"
                      data-testid="toggle-experience"
                      checked={options.includeExperience}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, includeExperience: e.target.checked }))
                      }
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: Editable Candidate Content */}
            {activeTab === "content" && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    data-testid="input-candidate-name"
                    value={resumeData.fullName}
                    onChange={(e) =>
                      setResumeData((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Professional Headline
                  </label>
                  <input
                    type="text"
                    data-testid="input-candidate-headline"
                    value={resumeData.headline}
                    onChange={(e) =>
                      setResumeData((prev) => ({ ...prev, headline: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      data-testid="input-candidate-email"
                      value={resumeData.email}
                      onChange={(e) =>
                        setResumeData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      data-testid="input-candidate-location"
                      value={resumeData.location}
                      onChange={(e) =>
                        setResumeData((prev) => ({ ...prev, location: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Executive Summary
                  </label>
                  <textarea
                    rows={3}
                    data-testid="input-candidate-summary"
                    value={resumeData.summary}
                    onChange={(e) =>
                      setResumeData((prev) => ({ ...prev, summary: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500 resize-none text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Bottom Reset Action */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <button
                type="button"
                data-testid="reset-customizer-btn"
                onClick={handleResetDefaults}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Auto-saved
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: Live Print Preview Sheet Container                    */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 no-print px-2">
            <span className="flex items-center gap-1.5 font-mono">
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Standard Letter / A4 Live Canvas</span>
            </span>
            <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
              100% Vector Selectable Text
            </span>
          </div>

          {/* Scalable Container for Live Sheet */}
          <div className="w-full overflow-x-auto rounded-2xl bg-black/40 border border-white/10 p-4 sm:p-6 shadow-2xl flex justify-center">
            <ResumePreview
              ref={printRef}
              data={resumeData}
              options={options}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
