"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Pin } from "lucide-react";
import { apiClient, extractData } from "@/lib/api-client";
import { BadgeCard } from "@/components/cards/badge-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { badgeRarity, normalizeBadges, readFeatured } from "./badge-model";

const CHANGED = "codepulse-featured-badges-changed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGED, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(CHANGED, callback); };
}

export function BadgeShowcase({ userId, badges: supplied, placement = "gallery" }: {
  userId: string; badges?: unknown; placement?: "header" | "gallery";
}) {
  const query = useQuery({
    queryKey: ["profile-badges", userId],
    queryFn: async () => extractData<unknown>(await apiClient.get(`/badges/user/${encodeURIComponent(userId)}`)),
  });
  const badges = useMemo(() => normalizeBadges(query.data ?? supplied), [supplied, query.data]);
  const key = `codepulse:featured-badges:${encodeURIComponent(userId)}`;
  const snapshot = useCallback(() => {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const featured = readFeatured(raw, badges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  const selected = badges.find(badge => badge.id === selectedId);
  const open = (id: string, button: HTMLButtonElement) => { trigger.current = button; setSelectedId(id); setMessage(""); };
  const toggle = () => {
    if (!selected) return;
    const exists = featured.includes(selected.id);
    if (!exists && featured.length >= 3) { setMessage("Unpin a badge before featuring another. The limit is three."); return; }
    const next = exists ? featured.filter(id => id !== selected.id) : [...featured, selected.id];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGED));
      setMessage(exists ? "Badge removed from featured badges." : "Badge featured on this device.");
    } catch { setMessage("Browser storage is unavailable. Your featured selection could not be saved."); }
  };
  const date = selected?.earnedAt ? new Date(selected.earnedAt) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unlock date unavailable";

  return <>
    {placement === "header" ? <section aria-label="Featured badges" className="mt-4 flex flex-wrap gap-2">
      {featured.map(id => {
        const badge = badges.find(item => item.id === id)!;
        return <button key={id} type="button" onClick={event => open(id, event.currentTarget)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-purple-400/30 px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-purple-400">
          <Pin className="size-3" aria-hidden="true" />{badge.name}
        </button>;
      })}
    </section> : <section aria-labelledby="badge-showcase-title" className="glass-card rounded-[20px] p-6">
      <h2 id="badge-showcase-title" className="mb-2 text-lg font-semibold">Badge collection</h2>
      <p className="mb-5 text-sm text-muted-foreground">Feature up to three earned badges in your profile header on this device.</p>
      {supplied === undefined && query.isPending ? <p role="status">Loading earned badges…</p> :
        query.isError && supplied === undefined ? <div role="alert">Could not load earned badges. <Button onClick={() => query.refetch()}>Retry badges</Button></div> :
          badges.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{badges.map(badge =>
            <BadgeCard key={badge.id} badge={badge} featured={featured.includes(badge.id)} onOpen={button => open(badge.id, button)} />)}</div> :
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Award aria-hidden="true" className="size-4" />No earned badges yet.</p>}
    </section>}
    <Dialog open={!!selected} onOpenChange={value => { if (!value) setSelectedId(null); }}>
      <DialogContent finalFocus={trigger} className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{selected?.name}</DialogTitle>
          <DialogDescription>{selected?.description}</DialogDescription></DialogHeader>
        {selected && <>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted-foreground">Rarity</dt><dd className="capitalize">{badgeRarity(selected.tier)} · {selected.tier}</dd></div>
            <div><dt className="text-muted-foreground">Unlocked</dt><dd>{dateLabel}</dd></div>
            <div><dt className="text-muted-foreground">Global unlock rate</dt><dd>{selected.globalUnlockPercent === undefined ?
              "Not available from the badge service yet." : `Unlocked by ${selected.globalUnlockPercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}% of developers`}</dd></div>
          </dl>
          <Button onClick={toggle} aria-pressed={featured.includes(selected.id)}>
            {featured.includes(selected.id) ? "Unpin featured badge" : "Equip to featured badges"}
          </Button>
          <p role="status" className="text-xs text-muted-foreground">{message || `${featured.length} of 3 featured slots used. Saved on this device.`}</p>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
