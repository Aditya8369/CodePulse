"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { User } from "@/hooks/api/use-auth";
import { profileShareLinks, profileUrl } from "@/lib/profile-sharing";

interface ProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function ProfileShareModal({ isOpen, onClose, user }: ProfileShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const url = typeof window === "undefined" ? "" : profileUrl(window.location.origin, user.username);
  const links = profileShareLinks(url);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not copy the profile link");
    }
  }

  async function downloadCard() {
    if (!cardRef.current || downloading) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#111827",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${user.username}-codepulse-profile.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Could not download the profile card");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg border border-white/10 bg-[#0b0f19] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" aria-hidden="true" />Share profile</DialogTitle>
          <DialogDescription>Preview your public profile card and share its link.</DialogDescription>
        </DialogHeader>

        <div ref={cardRef} className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-[#1b1640] via-[#111827] to-[#0e2330] p-6" aria-label="Profile card preview">
          <div className="flex items-center gap-4">
            {user.avatar ? <Image src={user.avatar} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-2xl border border-white/20 object-cover" crossOrigin="anonymous" /> : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">{(user.name || user.username).slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0"><p className="truncate text-lg font-bold">{user.name || user.username}</p><p className="truncate text-sm text-white/60">@{user.username}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-purple-300">{user.rating?.tier || "Developer"}{typeof user.rating?.rank === "number" ? ` · Rank #${user.rating.rank}` : ""}</p></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
            <div><p className="text-lg font-bold">{typeof user.rating?.xp === "number" ? user.rating.xp.toLocaleString() : "—"}</p><p className="text-xs text-white/60">XP</p></div>
            <div><p className="text-lg font-bold">{typeof user.stats?.battleWins === "number" ? user.stats.battleWins.toLocaleString() : "—"}</p><p className="text-xs text-white/60">Battle wins</p></div>
            <div><p className="text-lg font-bold">{typeof user.stats?.streak === "number" ? user.stats.streak : "—"}</p><p className="text-xs text-white/60">Day streak</p></div>
          </div>
          <p className="mt-4 text-center text-xs font-semibold tracking-widest text-purple-200">CODEPULSE</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <a href={links.x} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm hover:bg-white/5">Share on X <ExternalLink className="inline h-3 w-3" aria-hidden="true" /></a>
          <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm hover:bg-white/5">LinkedIn <ExternalLink className="inline h-3 w-3" aria-hidden="true" /></a>
          <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-center text-sm hover:bg-white/5">WhatsApp <ExternalLink className="inline h-3 w-3" aria-hidden="true" /></a>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyLink()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><span>{copied ? "Copied!" : "Copy Profile Link"}</span>{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}</button>
          <button type="button" onClick={() => void downloadCard()} disabled={downloading} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />{downloading ? "Downloading…" : "Download PNG"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
