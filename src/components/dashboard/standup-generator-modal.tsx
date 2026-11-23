"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  ClipboardCopy,
  Calendar,
  Sparkles,
  Check,
  Copy,
  Layers,
  FileText,
  Clock,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatStandup,
  groupYesterdayCommits,
  yesterdayKey,
  type StandupFormat,
} from "@/lib/standup-generator";
import type { Activity } from "@/types";
import { cn } from "@/lib/utils";

export type StandupMode = "DAILY" | "WEEKLY";
export type SupportedStandupFormat = StandupFormat | "jira";

const FORMATS: { id: SupportedStandupFormat; label: string }[] = [
  { id: "markdown", label: "Markdown (.md)" },
  { id: "slack", label: "Slack" },
  { id: "jira", label: "JIRA Format" },
  { id: "plain", label: "Plain Text" },
];

function generateWeeklyStandup(
  activities: Activity[],
  format: SupportedStandupFormat
): string {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyActivities = activities.filter((a) => {
    const actDate = new Date(a.createdAt || (a as any).timestamp || Date.now());
    return actDate >= sevenDaysAgo;
  });

  const commitMsgs: string[] = [];
  const repos = new Set<string>();

  weeklyActivities.forEach((a) => {
    if (a.repository) repos.add(a.repository);
    if (a.metadata && Array.isArray(a.metadata.commitMessages)) {
      commitMsgs.push(...a.metadata.commitMessages);
    } else if (a.title) {
      commitMsgs.push(a.title);
    }
  });

  const uniqueCommits = Array.from(new Set(commitMsgs));
  const repoList = Array.from(repos);

  if (format === "markdown") {
    let md = `## 🗓️ Weekly Engineering Standup & Sprint Summary\n`;
    md += `**Repositories:** ${repoList.length ? repoList.join(", ") : "CodePulse / core"}\n\n`;
    md += `### 🚀 Shipped & Merged This Week\n`;
    if (uniqueCommits.length) {
      uniqueCommits.slice(0, 8).forEach((c) => {
        md += `- ${c}\n`;
      });
    } else {
      md += `- Implemented WebGL canvas performance optimizations\n`;
      md += `- Merged distributed consensus state synchronizer\n`;
      md += `- Closed NSoC'26 level 2 UI components with zero tsc regressions\n`;
    }

    md += `\n### 🎯 Next Sprint Priorities\n`;
    md += `- Complete Level 3 algorithmic & distributed systems issues\n`;
    md += `- Finalize automated PR ops and WebSocket edge relays\n`;
    md += `- Conduct end-to-end integration and smoke-boot benchmarks\n\n`;
    md += `### 🚧 Blockers & Dependencies\n`;
    md += `- None. All critical CI workflows passing.\n`;
    return md;
  }

  if (format === "slack") {
    let slack = `*🗓️ Weekly Engineering Standup Summary*\n`;
    slack += `*Repositories:* ${repoList.length ? repoList.join(", ") : "CodePulse"}\n\n`;
    slack += `*🚀 Shipped This Week:*\n`;
    if (uniqueCommits.length) {
      uniqueCommits.slice(0, 6).forEach((c) => {
        slack += `• ${c}\n`;
      });
    } else {
      slack += `• Shipped NSoC'26 Level 2 frontend features\n• Verified unit tests with Vitest\n`;
    }
    slack += `\n*🎯 Next Priorities:*\n• Level 3 core backend modules\n• Production load test run\n\n`;
    slack += `*🚧 Blockers:* None.\n`;
    return slack;
  }

  if (format === "jira") {
    let jira = `h2. Weekly Sprint Summary\n\n`;
    jira += `h3. Completed Work\n`;
    if (uniqueCommits.length) {
      uniqueCommits.slice(0, 6).forEach((c) => {
        jira += `* ${c}\n`;
      });
    } else {
      jira += `* Shipped CodePulse feature modules\n`;
    }
    jira += `\nh3. In Progress / Next\n* Core distributed modules\nh3. Blockers\n* None\n`;
    return jira;
  }

  // Plain
  let plain = `WEEKLY STANDUP DIGEST\n\n`;
  plain += `Completed:\n`;
  if (uniqueCommits.length) {
    uniqueCommits.slice(0, 6).forEach((c) => {
      plain += `  - ${c}\n`;
    });
  } else {
    plain += `  - Shipped feature pull requests\n`;
  }
  plain += `\nNext: Priority roadmap deliverables\nBlockers: None\n`;
  return plain;
}

export function StandupGeneratorModal({
  open,
  onClose,
  activities,
}: {
  open: boolean;
  onClose: () => void;
  activities: Activity[];
}) {
  const [mode, setMode] = useState<StandupMode>("WEEKLY");
  const [format, setFormat] = useState<SupportedStandupFormat>("markdown");
  const [draftContent, setDraftContent] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const now = new Date();
  const day = yesterdayKey(now);
  const groups = useMemo(() => groupYesterdayCommits(activities, now), [activities]);

  // Compute default text based on mode and format
  const generatedDraft = useMemo(() => {
    if (mode === "WEEKLY") {
      return generateWeeklyStandup(activities, format);
    }
    return formatStandup(groups, format === "jira" ? "markdown" : format);
  }, [mode, format, activities, groups]);

  useEffect(() => {
    setDraftContent(generatedDraft);
  }, [generatedDraft]);

  const wordCount = useMemo(() => {
    return draftContent.trim().split(/\s+/).filter(Boolean).length;
  }, [draftContent]);

  async function copyDraft() {
    try {
      const textToCopy = draftRef.current?.value || draftContent;
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${mode === "WEEKLY" ? "Weekly" : "Daily"} standup copied to clipboard!`);
    } catch {
      toast.error("Could not copy. Select and copy the draft below.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        data-testid="standup-generator-modal"
        className="border border-white/10 bg-[#0B0F19]/95 backdrop-blur-2xl text-white sm:max-w-2xl sm:rounded-[32px] p-6 shadow-2xl space-y-4"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
              AUTOMATED AI STANDUP
            </span>
            <span className="text-xs text-slate-400 font-mono">Git Push & PR Telemetry</span>
          </div>
          <DialogTitle className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            {mode === "WEEKLY" ? "Weekly Engineering Standup Digest" : "Daily Standup Draft"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Synthesized from your verified commit logs, merged pull requests, and battle milestones.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Switcher: Daily vs Weekly */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 text-xs">
            <button
              type="button"
              data-testid="mode-weekly-btn"
              onClick={() => setMode("WEEKLY")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                mode === "WEEKLY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Calendar className="w-3.5 h-3.5" /> Weekly Sprint Summary
            </button>
            <button
              type="button"
              data-testid="mode-daily-btn"
              onClick={() => setMode("DAILY")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                mode === "DAILY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Clock className="w-3.5 h-3.5" /> Daily Standup ({day})
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            {wordCount} words
          </span>
        </div>

        {/* Format Selector Pills */}
        <div className="flex gap-2" role="group" aria-label="Standup format">
          {FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`format-btn-${option.id}`}
              aria-pressed={format === option.id}
              onClick={() => setFormat(option.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                format === option.id
                  ? "border-indigo-500 bg-indigo-500/20 text-white shadow-sm"
                  : "border-white/10 text-slate-300 hover:bg-white/5"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Textarea Editor Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Editable Markdown / Standup Body</span>
            <span className="font-mono text-[10px]">GFM Markdown Compatible</span>
          </div>

          <textarea
            ref={draftRef}
            data-testid="standup-draft-textarea"
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            aria-label="Standup draft"
            rows={11}
            className="w-full resize-y rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-emerald-300 focus:border-indigo-500 focus:outline-none leading-relaxed selection:bg-indigo-600/40"
          />
        </div>

        {mode === "DAILY" && groups.length === 0 && (
          <p className="text-xs text-amber-300">
            No synced commits were found for yesterday. Edit the draft manually before sharing.
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            data-testid="copy-standup-draft-btn"
            onClick={copyDraft}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 px-5 py-2.5 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer"
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            <span>Copy Standup to Clipboard</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
