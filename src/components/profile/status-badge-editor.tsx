"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getProfileStatus, saveProfileStatus, type ProfileStatus } from "@/lib/storage";

const PRESETS = [
  { emoji: "🚀", label: "Shipping", message: "Shipping something new" },
  { emoji: "☕", label: "Coffee Mode", message: "Fueled by coffee" },
  { emoji: "🐛", label: "Debugging", message: "Hunting bugs" },
  { emoji: "🧠", label: "Deep Work", message: "In deep work mode" },
  { emoji: "⚡", label: "Speedrunning", message: "Speedrunning my goals" },
];

export function StatusBadgeEditorModal({ userId }: { userId: string }) {
  const [status, setStatus] = useState<ProfileStatus | null>(() => getProfileStatus(userId));
  const [emoji, setEmoji] = useState(PRESETS[0].emoji);
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);

  function openEditor() {
    setEmoji(status?.emoji || PRESETS[0].emoji);
    setMessage(status?.message || "");
    setStorageError(false);
    setIsOpen(true);
  }

  function save() {
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > 60) return;
    const nextStatus = { emoji, message: trimmed };
    if (!saveProfileStatus(userId, nextStatus)) {
      setStorageError(true);
      return;
    }
    setStatus(nextStatus);
    setIsOpen(false);
  }

  function clear() {
    if (!saveProfileStatus(userId, null)) {
      setStorageError(true);
      return;
    }
    setStatus(null);
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-xs text-purple-100 transition-colors hover:bg-purple-400/20"
        aria-label={status ? `Edit status: ${status.emoji} ${status.message}` : "Set status"}
      >
        {status ? (
          <>
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-purple-300" aria-hidden="true" />
            <span aria-hidden="true">{status.emoji}</span>
            <span className="truncate">{status.message}</span>
          </>
        ) : "+ Set status"}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0b0f19] text-white">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Set your coding status</DialogTitle>
              <DialogDescription>Share what you are working on right now.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2" aria-label="Choose an emoji">
              {PRESETS.map((preset) => (
                <button
                  key={preset.emoji}
                  type="button"
                  onClick={() => setEmoji(preset.emoji)}
                  aria-label={preset.label}
                  aria-pressed={emoji === preset.emoji}
                  className={`rounded-lg border px-3 py-2 text-lg transition-colors ${emoji === preset.emoji ? "border-purple-400 bg-purple-400/20" : "border-white/10 hover:bg-white/10"}`}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Preset status messages">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setEmoji(preset.emoji); setMessage(preset.message); }}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="profile-status-message" className="mb-1 block text-sm font-medium">Status message</label>
              <input
                id="profile-status-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={60}
                placeholder="What are you working on?"
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <p className="mt-1 text-right text-xs text-white/50" aria-live="polite">{message.length}/60</p>
            </div>
            {storageError && <p role="alert" className="text-xs text-red-300">Your browser could not save this status. Please allow local storage and try again.</p>}
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={clear} disabled={!status} className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40">Clear Status</button>
              <button type="button" onClick={save} disabled={!message.trim()} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Save Status</button>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
