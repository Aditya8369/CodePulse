"use client";

import { useState } from "react";
import { AtSign, BookOpen, BriefcaseBusiness, Code2, ExternalLink, Globe, MessageCircle, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SocialPlatform = "X / Twitter" | "LinkedIn" | "Discord" | "YouTube" | "Substack / Dev.to" | "LeetCode" | "Custom Website";
export interface SocialLink { platform: SocialPlatform; url: string }

const STORAGE_KEY = "codepulse_social_links";
const PLATFORMS: SocialPlatform[] = ["X / Twitter", "LinkedIn", "Discord", "YouTube", "Substack / Dev.to", "LeetCode", "Custom Website"];
const ICONS = { "X / Twitter": AtSign, LinkedIn: BriefcaseBusiness, Discord: MessageCircle, YouTube: Play, "Substack / Dev.to": BookOpen, LeetCode: Code2, "Custom Website": Globe };
const HOSTS: Partial<Record<SocialPlatform, string[]>> = {
  "X / Twitter": ["x.com", "twitter.com"],
  LinkedIn: ["linkedin.com"],
  Discord: ["discord.com", "discord.gg"],
  YouTube: ["youtube.com", "youtu.be"],
  "Substack / Dev.to": ["substack.com", "dev.to"],
  LeetCode: ["leetcode.com"],
};

export function validateSocialUrl(platform: SocialPlatform, value: string): string | null {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { return "Enter a full URL beginning with https://"; }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    return "Use a secure https:// URL without embedded credentials";
  }
  const allowed = HOSTS[platform];
  if (allowed && !allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    return `Use a ${platform} link`;
  }
  return null;
}

function inferPlatform(url: string): SocialPlatform {
  try {
    const host = new URL(url).hostname;
    return PLATFORMS.find((platform) => HOSTS[platform]?.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) || "Custom Website";
  } catch { return "Custom Website"; }
}

function loadLinks(userId: string, initialLinks: Array<{ url: string }>): SocialLink[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved?.[userId])) {
      return saved[userId].filter((link: unknown): link is SocialLink => {
        if (!link || typeof link !== "object") return false;
        const candidate = link as SocialLink;
        return PLATFORMS.includes(candidate.platform) && typeof candidate.url === "string" && !validateSocialUrl(candidate.platform, candidate.url);
      });
    }
  } catch { /* Continue with profile links when storage is unavailable. */ }
  return initialLinks
    .filter((link) => typeof link?.url === "string" && !validateSocialUrl(inferPlatform(link.url), link.url))
    .map((link) => ({ platform: inferPlatform(link.url), url: link.url }));
}

function persistLinks(userId: string, links: SocialLink[]): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const all = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    all[userId] = links;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}

export function SocialLinksManager({ userId, initialLinks }: { userId: string; initialLinks: Array<{ url: string }> }) {
  const [links, setLinks] = useState<SocialLink[]>(() => loadLinks(userId, initialLinks));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [platform, setPlatform] = useState<SocialPlatform>("X / Twitter");
  const [url, setUrl] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const error = url.trim() ? validateSocialUrl(platform, url) : attempted ? "Enter a URL" : null;

  function openEditor(index: number | null) {
    setEditing(index);
    setPlatform(index === null ? "X / Twitter" : links[index].platform);
    setUrl(index === null ? "" : links[index].url);
    setAttempted(false);
    setStorageError(false);
    setOpen(true);
  }

  function saveLinks(next: SocialLink[]): boolean {
    if (!persistLinks(userId, next)) { setStorageError(true); return false; }
    setLinks(next);
    setOpen(false);
    return true;
  }

  function save() {
    setAttempted(true);
    if (!url.trim() || validateSocialUrl(platform, url)) return;
    const next = [...links];
    const link = { platform, url: url.trim() };
    if (editing === null) next.push(link);
    else next[editing] = link;
    saveLinks(next);
  }

  function remove() {
    if (editing !== null) saveLinks(links.filter((_, index) => index !== editing));
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {links.map((link, index) => {
          const Icon = ICONS[link.platform];
          return (
            <span key={`${link.platform}-${index}`} className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/5 text-xs">
              <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.url} className="inline-flex min-w-0 items-center gap-1.5 rounded-l-full px-3 py-1.5 hover:bg-white/10">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{link.platform}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
              <button type="button" onClick={() => openEditor(index)} aria-label={`Edit ${link.platform} link`} className="rounded-r-full border-l border-white/10 px-2 py-1.5 hover:bg-white/10">
                <Pencil className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          );
        })}
        <button type="button" onClick={() => openEditor(null)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add social link
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border border-white/10 bg-[#0b0f19] text-white">
          <DialogHeader>
            <DialogTitle>{editing === null ? "Add social link" : "Edit social link"}</DialogTitle>
            <DialogDescription>Show where people can find your work.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="social-platform" className="mb-1 block text-sm">Platform</label>
              <select id="social-platform" value={platform} onChange={(event) => setPlatform(event.target.value as SocialPlatform)} className="w-full rounded-lg border border-white/15 bg-[#0b0f19] px-3 py-2 text-sm">
                {PLATFORMS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="social-url" className="mb-1 block text-sm">Profile URL</label>
              <input id="social-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/your-profile" aria-invalid={Boolean(error)} aria-describedby={error ? "social-url-error" : undefined} className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-purple-400" />
              {error && <p id="social-url-error" role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
            </div>
            {storageError && <p role="alert" className="text-xs text-red-300">Your browser could not save these links. Please allow local storage and try again.</p>}
            <div className="flex justify-between gap-2">
              {editing !== null ? <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-300"><Trash2 className="h-3.5 w-3.5" />Delete</button> : <span />}
              <button type="button" onClick={save} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white">Save link</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
