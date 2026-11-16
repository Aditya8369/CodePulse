"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatStandup, groupYesterdayCommits, yesterdayKey, type StandupFormat } from "@/lib/standup-generator";
import type { Activity } from "@/types";

const FORMATS: { id: StandupFormat; label: string }[] = [
  { id: "markdown", label: "Markdown" },
  { id: "slack", label: "Slack" },
  { id: "plain", label: "Plain text" },
];

export function StandupGeneratorModal({ open, onClose, activities }: {
  open: boolean;
  onClose: () => void;
  activities: Activity[];
}) {
  const [format, setFormat] = useState<StandupFormat>("markdown");
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const now = new Date();
  const day = yesterdayKey(now);
  const groups = groupYesterdayCommits(activities, now);
  const draft = formatStandup(groups, format);

  async function copyDraft() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(draftRef.current?.value ?? draft);
      toast.success("Standup copied to clipboard");
    } catch {
      toast.error("Could not copy. Select and copy the draft below.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="border border-white/10 bg-[#0B0F19] text-white sm:max-w-xl sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>Daily standup draft</DialogTitle>
          <DialogDescription>
            Yesterday ({day}) from your latest synced GitHub push events. Add your plan and blockers before sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Standup format">
          {FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={format === option.id}
              onClick={() => setFormat(option.id)}
              className={`rounded-lg border px-3 py-2 text-sm ${format === option.id ? "border-primary bg-primary/20 text-white" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Preview and edit before copying</span>
          <textarea
            ref={draftRef}
            key={`${day}-${format}-${draft}`}
            defaultValue={draft}
            aria-label="Standup draft"
            rows={12}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-sm text-white focus:border-primary focus:outline-none"
          />
        </label>
        {groups.length === 0 && <p className="text-xs text-amber-300">No synced commits were found for yesterday. Sync GitHub and try again, or edit the draft manually.</p>}
        <button type="button" onClick={copyDraft} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white hover:opacity-90">
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy draft
        </button>
      </DialogContent>
    </Dialog>
  );
}
