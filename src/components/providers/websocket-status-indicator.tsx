"use client";

import { useBattleSocketStatus } from "@/components/providers/battle-socket-provider";
import { cn } from "@/lib/utils";

const labels = {
  connecting: "Battle connecting",
  connected: "Battle connected",
  reconnecting: "Battle reconnecting",
  disconnected: "Battle disconnected",
} as const;

export function WebSocketStatusIndicator() {
  const { status, attempt, retry } = useBattleSocketStatus();
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground">
      <span aria-hidden="true" className={cn(
        "size-2 shrink-0 rounded-full",
        status === "connected" && "bg-emerald-400",
        status === "connecting" && "bg-amber-400 motion-safe:animate-pulse",
        status === "reconnecting" && "bg-amber-500 motion-safe:animate-pulse",
        status === "disconnected" && "bg-red-400",
      )} />
      <span className="sr-only sm:not-sr-only">{labels[status]}{status === "reconnecting" && attempt > 0 ? ` (${attempt}/5)` : ""}</span>
      {status === "disconnected" && (
        <button type="button" onClick={retry} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline">
          Retry now
        </button>
      )}
    </div>
  );
}
