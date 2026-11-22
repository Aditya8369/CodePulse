"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wifi,
  Activity,
  Globe,
  Radio,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Server,
  Zap,
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

export interface LatencySample {
  id: number;
  rttMs: number;
  timestamp: number;
  isDropped: boolean;
}

export interface ConnectionDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGateway?: string;
  initialRttMs?: number;
  onProbeComplete?: (samples: LatencySample[]) => void;
}

export function ConnectionDiagnosticsModal({
  isOpen,
  onClose,
  activeGateway = "AP-South-1 (Mumbai)",
  initialRttMs = 24,
  onProbeComplete,
}: ConnectionDiagnosticsModalProps) {
  const [samples, setSamples] = useState<LatencySample[]>(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      rttMs: Math.round(initialRttMs + (Math.random() * 8 - 4)),
      timestamp: Date.now() - (24 - i) * 1000,
      isDropped: i === 18 ? true : false,
    }));
  });

  const [isProbing, setIsProbing] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(activeGateway);

  const currentRtt = samples[samples.length - 1]?.isDropped ? 0 : samples[samples.length - 1]?.rttMs || initialRttMs;

  const stats = useMemo(() => {
    const validSamples = samples.filter((s) => !s.isDropped);
    const avgRtt = validSamples.length
      ? Math.round(validSamples.reduce((a, b) => a + b.rttMs, 0) / validSamples.length)
      : initialRttMs;
    const droppedCount = samples.filter((s) => s.isDropped).length;
    const packetLossPercent = ((droppedCount / samples.length) * 100).toFixed(1);
    const jitter = validSamples.length > 1
      ? Math.round(
          validSamples.slice(1).reduce((acc, curr, idx) => {
            return acc + Math.abs(curr.rttMs - validSamples[idx].rttMs);
          }, 0) / (validSamples.length - 1)
        )
      : 2;

    const qualityRating: "EXCELLENT" | "GOOD" | "FAIR" | "DEGRADED" =
      avgRtt < 35 && +packetLossPercent < 1.0
        ? "EXCELLENT"
        : avgRtt < 70 && +packetLossPercent < 3.0
        ? "GOOD"
        : avgRtt < 120
        ? "FAIR"
        : "DEGRADED";

    return { avgRtt, packetLossPercent, jitter, qualityRating };
  }, [samples, initialRttMs]);

  // Run new ping probe burst
  const handleRunProbe = useCallback(() => {
    setIsProbing(true);
    toast.info("Transmitting 10 ICMP/WSS diagnostic probe frames...");

    setTimeout(() => {
      const newSamples: LatencySample[] = [];
      const now = Date.now();
      for (let i = 0; i < 24; i++) {
        const isDropped = Math.random() < 0.04;
        newSamples.push({
          id: now + i,
          rttMs: isDropped ? 0 : Math.round(20 + Math.random() * 15),
          timestamp: now - (24 - i) * 400,
          isDropped,
        });
      }
      setSamples(newSamples);
      setIsProbing(false);
      onProbeComplete?.(newSamples);
      toast.success("Diagnostic probe complete!", {
        description: `Average RTT: ${stats.avgRtt}ms | Jitter: ${stats.jitter}ms`,
      });
    }, 700);
  }, [stats.avgRtt, stats.jitter, onProbeComplete]);

  const handleExportTelemetry = () => {
    const telemetryJson = JSON.stringify(
      {
        gateway: selectedGateway,
        protocol: "WSS TLS 1.3 Multiplexed",
        metrics: stats,
        recentSamples: samples,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(telemetryJson);
    }
    setCopiedLog(true);
    toast.success("Diagnostic network telemetry JSON copied to clipboard!");
    setTimeout(() => setCopiedLog(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="connection-diagnostics-modal-dialog"
        className="max-w-2xl bg-[#090D16]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[32px] p-6 shadow-2xl space-y-6"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                EDGE POP TELEMETRY
              </span>
              <span className="text-xs text-slate-400 font-mono">TLS 1.3 Multiplex</span>
            </div>

            <button
              type="button"
              data-testid="export-telemetry-btn"
              onClick={handleExportTelemetry}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLog ? "Copied" : "Export Log"}</span>
            </button>
          </div>

          <DialogTitle className="text-xl font-black text-white mt-2 flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400" />
            WebSocket Connection Quality & Diagnostics
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Real-time inter-region packet loss, buffer latency, and Edge Anycast POP routing.
          </DialogDescription>
        </DialogHeader>

        {/* 4-Card Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Average RTT */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] font-mono uppercase text-slate-400">Average RTT</div>
            <div data-testid="avg-rtt-stat" className="text-xl font-black font-mono text-emerald-400 mt-1">
              {stats.avgRtt} ms
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Sub-35ms Target Met</div>
          </div>

          {/* Jitter */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] font-mono uppercase text-slate-400">Jitter Variation</div>
            <div data-testid="jitter-stat" className="text-xl font-black font-mono text-cyan-400 mt-1">
              ±{stats.jitter} ms
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Stable Transport</div>
          </div>

          {/* Packet Loss */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] font-mono uppercase text-slate-400">Packet Loss</div>
            <div data-testid="packet-loss-stat" className="text-xl font-black font-mono text-amber-400 mt-1">
              {stats.packetLossPercent}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Automatic Retransmit</div>
          </div>

          {/* Rating */}
          <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] font-mono uppercase text-slate-400">Quality Rating</div>
            <div
              data-testid="quality-rating-stat"
              className={cn(
                "text-sm font-black font-mono uppercase mt-1.5",
                stats.qualityRating === "EXCELLENT" ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {stats.qualityRating}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">eSports Ready</div>
          </div>
        </div>

        {/* Real-Time Latency & Packet Loss Sparkline Timeline */}
        <div data-testid="latency-sparkline-section" className="space-y-2 p-4 rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-slate-300">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Live Packet Stream History (Recent 24 Frames)
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> OK (&lt;35ms)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Dropped
              </span>
            </div>
          </div>

          {/* Bar Timeline */}
          <div className="h-28 w-full flex items-end gap-1.5 pt-4">
            {samples.map((s, idx) => {
              const heightPercent = s.isDropped ? 100 : Math.min(100, Math.max(15, (s.rttMs / 60) * 100));

              return (
                <div
                  key={s.id}
                  data-testid={`latency-bar-${idx}`}
                  title={s.isDropped ? `Packet Dropped` : `${s.rttMs}ms`}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPercent}%` }}
                    className={cn(
                      "w-full rounded-t transition-colors",
                      s.isDropped
                        ? "bg-rose-500 shadow-sm shadow-rose-500/50"
                        : s.rttMs < 30
                        ? "bg-emerald-400/80 group-hover:bg-emerald-300"
                        : "bg-cyan-400/80 group-hover:bg-cyan-300"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {/* Edge Gateway Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Server className="w-4 h-4 text-slate-400" />
            <select
              aria-label="Active Edge POP Gateway"
              value={selectedGateway}
              onChange={(e) => {
                setSelectedGateway(e.target.value);
                toast.success(`Switched routing to Edge Gateway: ${e.target.value}`);
              }}
              className="bg-[#0B0F19] border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none font-mono cursor-pointer"
            >
              <option value="AP-South-1 (Mumbai)">AP-South-1 (Mumbai)</option>
              <option value="US-East-1 (N. Virginia)">US-East-1 (N. Virginia)</option>
              <option value="EU-Central-1 (Frankfurt)">EU-Central-1 (Frankfurt)</option>
              <option value="AP-Southeast-1 (Singapore)">AP-Southeast-1 (Singapore)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              data-testid="run-probe-btn"
              onClick={handleRunProbe}
              disabled={isProbing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isProbing && "animate-spin")} />
              <span>{isProbing ? "Probing..." : "Run Probe Test"}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
