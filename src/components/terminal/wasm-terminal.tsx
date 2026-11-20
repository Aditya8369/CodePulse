"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Terminal,
  Cpu,
  HardDrive,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  Save,
} from "lucide-react";
import {
  DEFAULT_TERMINAL_CHALLENGES,
  TerminalChallenge,
  V86AlpineVm,
  VmBootTelemetry,
} from "@/lib/wasm/v86-alpine-vm";
import { XtermHandle, XtermWrapper } from "./xterm-wrapper";
import { cn } from "@/lib/utils";

export interface WasmTerminalProps {
  challenges?: TerminalChallenge[];
  initialChallengeId?: string;
  vmInstance?: V86AlpineVm;
  className?: string;
}

export function WasmTerminal({
  challenges = DEFAULT_TERMINAL_CHALLENGES,
  initialChallengeId,
  vmInstance,
  className,
}: WasmTerminalProps) {
  const vm = useMemo(() => vmInstance ?? new V86AlpineVm(), [vmInstance]);
  const xtermRef = useRef<XtermHandle>(null);

  const [telemetry, setTelemetry] = useState<VmBootTelemetry>(() =>
    vm.getTelemetry()
  );
  const [prompt, setPrompt] = useState<string>(() => vm.getPrompt());
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(
    initialChallengeId ?? challenges[0]?.id ?? ""
  );
  const [verificationResult, setVerificationResult] = useState<{
    passed: boolean;
    feedback: string;
  } | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<string>("Synced");

  useEffect(() => {
    let active = true;
    void vm.boot().then((bootStats) => {
      if (!active) return;
      setTelemetry(bootStats);
      setPrompt(vm.getPrompt());
      xtermRef.current?.writeln(
        `\x1b[1;36m[v86-wasm]\x1b[0m Alpine Linux 3.20.3 (x86-wasm) booted in \x1b[1;32m${bootStats.bootDurationMs}ms\x1b[0m (0 server CPU)`
      );
      xtermRef.current?.writeln(
        "\x1b[90mTools ready: sh, curl, git, python3, vi • Type `help` for commands.\x1b[0m"
      );
    });
    return () => {
      active = false;
    };
  }, [vm]);

  const handleCommand = useCallback(
    async (command: string) => {
      const result = await vm.execute(command);
      if (result.clearScreen) {
        xtermRef.current?.clear();
      } else if (result.output) {
        xtermRef.current?.writeln(result.output);
      }
      setPrompt(vm.getPrompt());

      // Persist VFS state to IndexedDB after mutating commands
      const saved = await vm.persistSnapshot();
      setSnapshotStatus(saved ? "Saved in IndexedDB" : "In-Memory VFS");
    },
    [vm]
  );

  const activeChallenge = useMemo(
    () =>
      challenges.find((c) => c.id === selectedChallengeId) ?? challenges[0],
    [challenges, selectedChallengeId]
  );

  const handleVerifyChallenge = useCallback(() => {
    if (!activeChallenge) return;
    const outcome = activeChallenge.verify(vm);
    setVerificationResult(outcome);
  }, [activeChallenge, vm]);

  const handleResetVm = useCallback(async () => {
    vm.resetFilesystem();
    setPrompt(vm.getPrompt());
    setVerificationResult(null);
    xtermRef.current?.clear();
    xtermRef.current?.writeln(
      "\x1b[1;33m[v86-wasm]\x1b[0m Root filesystem reset to clean Alpine 3.20 snapshot."
    );
    await vm.persistSnapshot();
    setSnapshotStatus("Reset & Synced");
  }, [vm]);

  return (
    <div
      data-testid="wasm-linux-terminal"
      className={cn(
        "rounded-2xl border border-white/10 bg-[#080D1A]/90 p-5 shadow-2xl space-y-4",
        className
      )}
    >
      {/* Header & Client-Side Wasm Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Alpine Linux WebAssembly Sandbox (v86)
            </h3>
            <p className="text-xs text-muted-foreground">
              100% client-side x86 Wasm execution · Zero backend container cost
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            data-testid="wasm-boot-badge"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 font-mono text-emerald-300"
          >
            <Cpu className="h-3.5 w-3.5" />
            {telemetry.booted ? `Booted ${telemetry.bootDurationMs}ms` : "Booting..."}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 px-2.5 py-1 font-mono text-cyan-300">
            <HardDrive className="h-3.5 w-3.5" />
            RootFS {(telemetry.rootfsSizeBytes / (1024 * 1024)).toFixed(1)} MB
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1 text-muted-foreground">
            <Save className="h-3.5 w-3.5 text-amber-400" />
            {snapshotStatus}
          </span>
          <button
            type="button"
            onClick={handleResetVm}
            data-testid="wasm-reset-btn"
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Interactive xterm Terminal Viewport */}
      <XtermWrapper
        ref={xtermRef}
        prompt={prompt}
        onCommand={handleCommand}
      />

      {/* Interactive Terminal Challenge Runner */}
      {activeChallenge && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  {activeChallenge.difficulty} Challenge
                </span>
                <h4 className="text-sm font-semibold text-foreground">
                  {activeChallenge.title}
                </h4>
              </div>
              <p className="text-xs text-muted-foreground">
                {activeChallenge.prompt}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Select terminal challenge"
                value={activeChallenge.id}
                onChange={(e) => {
                  setSelectedChallengeId(e.target.value);
                  setVerificationResult(null);
                }}
                className="rounded-lg border border-white/10 bg-[#0B1120] px-2.5 py-1.5 text-xs text-foreground"
              >
                {challenges.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleVerifyChallenge}
                data-testid="verify-challenge-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                Verify Solution
              </button>
            </div>
          </div>

          {verificationResult && (
            <div
              data-testid="challenge-verification-banner"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                verificationResult.passed
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border border-red-500/30"
              )}
            >
              {verificationResult.passed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{verificationResult.feedback}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
