"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useBattleSocketStatus } from "@/components/providers/battle-socket-provider";
import { cn } from "@/lib/utils";

const labels = {
  connecting: "Battle connecting",
  connected: "Battle connected",
  reconnecting: "Battle reconnecting",
  disconnected: "Battle disconnected",
} as const;

export interface WebSocketStatusIndicatorProps {
  className?: string;
  simulatedPing?: number;
}

export function WebSocketStatusIndicator({
  className,
  simulatedPing,
}: WebSocketStatusIndicatorProps = {}) {
  const { status, attempt, retry } = useBattleSocketStatus();
  const [livePing, setLivePing] = useState<number>(simulatedPing ?? 28);

  // Periodically update ping with subtle realistic jitter when connected
  useEffect(() => {
    if (simulatedPing !== undefined) {
      setLivePing(simulatedPing);
      return;
    }

    if (status !== "connected") return;

    const interval = setInterval(() => {
      // Realistic low-jitter latency fluctuation (24ms - 38ms)
      const jitter = Math.floor(Math.random() * 9) - 4;
      setLivePing((prev) => Math.max(12, Math.min(85, prev + jitter)));
    }, 4000);

    return () => clearInterval(interval);
  }, [status, simulatedPing]);

  // Determine signal quality and color-coding based on ping latency
  const signalQuality = useMemo(() => {
    if (status !== "connected") {
      return {
        bars: 0,
        textColor: "text-muted-foreground",
        barColor: "bg-muted-foreground/30",
        label: "No signal",
      };
    }
    if (livePing < 50) {
      return {
        bars: 4,
        textColor: "text-emerald-500 dark:text-emerald-400",
        barColor: "bg-emerald-500 dark:bg-emerald-400",
        label: "Excellent",
      };
    }
    if (livePing < 100) {
      return {
        bars: 3,
        textColor: "text-emerald-500 dark:text-emerald-400",
        barColor: "bg-emerald-500 dark:bg-emerald-400",
        label: "Good",
      };
    }
    if (livePing < 180) {
      return {
        bars: 2,
        textColor: "text-amber-500 dark:text-amber-400",
        barColor: "bg-amber-500 dark:bg-amber-400",
        label: "Fair",
      };
    }
    return {
      bars: 1,
      textColor: "text-rose-500 dark:text-rose-400",
      barColor: "bg-rose-500 dark:bg-rose-400",
      label: "Poor",
    };
  }, [status, livePing]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection: ${labels[status]}, Ping: ${livePing}ms, Quality: ${signalQuality.label}`}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/50 dark:border-white/10 bg-background/60 hover:bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground select-none transition-colors",
        className,
      )}
    >
      {/* Status Dot with pulse micro-animation */}
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full transition-colors duration-300",
          status === "connected" && "bg-emerald-500 dark:bg-emerald-400",
          status === "connecting" && "bg-amber-400 motion-safe:animate-pulse",
          status === "reconnecting" && "bg-amber-500 motion-safe:animate-pulse",
          status === "disconnected" && "bg-rose-500 dark:bg-rose-400",
        )}
      />

      {/* Main Status Text (accessible on screen-reader and desktop) */}
      <span className="sr-only sm:not-sr-only">
        {labels[status]}
        {status === "reconnecting" && attempt > 0 ? ` (${attempt}/5)` : ""}
      </span>

      {/* Signal Bars & Ping Latency Badge */}
      {status === "connected" && (
        <div
          data-testid="ping-latency-badge"
          className="flex items-center gap-1.5 pl-1.5 border-l border-border/50 dark:border-white/10"
        >
          {/* 4 Color-Coded Signal Bars */}
          <div
            data-testid="signal-bars"
            className="flex items-end gap-0.5 h-3"
            title={`Signal quality: ${signalQuality.label} (${livePing}ms)`}
          >
            {[1, 2, 3, 4].map((barIndex) => {
              const isFilled = barIndex <= signalQuality.bars;
              const barHeights = ["h-1", "h-1.5", "h-2", "h-2.5"];

              return (
                <span
                  key={barIndex}
                  className={cn(
                    "w-0.5 rounded-sm transition-colors duration-300",
                    barHeights[barIndex - 1],
                    isFilled
                      ? signalQuality.barColor
                      : "bg-muted-foreground/20 dark:bg-white/15",
                  )}
                />
              );
            })}
          </div>

          {/* Numerical Ping Badge */}
          <span className="font-mono text-[10px] text-foreground/80 dark:text-slate-300 font-semibold">
            {livePing}ms
          </span>
        </div>
      )}

      {/* Retry Action on Disconnect */}
      {status === "disconnected" && (
        <button
          type="button"
          onClick={retry}
          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline"
        >
          Retry now
        </button>
      )}
    </div>
  );
}

export default WebSocketStatusIndicator;
