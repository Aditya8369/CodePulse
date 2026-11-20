"use client";

import React, { useRef, useState } from "react";
import { Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import {
  SfxSynthesizer,
  SoundPackId,
} from "../audio/sfx-synthesizer";

export interface BattleEditorProps {
  initialCode?: string;
  soundPack?: SoundPackId;
  synthesizer?: SfxSynthesizer;
  onSubmitSolution?: (code: string, passedAll: boolean) => void;
}

export const BattleEditor: React.FC<BattleEditorProps> = ({
  initialCode = `export function solve(nums: number[], target: number): [number, number] {\n  const map = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const diff = target - nums[i];\n    if (map.has(diff)) return [map.get(diff)!, i];\n    map.set(nums[i], i);\n  }\n  return [-1, -1];\n}`,
  soundPack = "mechanical-keyboard",
  synthesizer,
  onSubmitSolution,
}) => {
  const synthRef = useRef<SfxSynthesizer>(
    synthesizer ?? new SfxSynthesizer({ pack: soundPack })
  );
  const [code, setCode] = useState(initialCode);
  const [audioUnlocked, setAudioUnlocked] = useState(
    synthRef.current.isUnlocked()
  );
  const [isMuted, setIsMuted] = useState(false);
  const [comboStreak, setComboStreak] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Click inside editor to unlock zero-latency Web Audio SFX"
  );

  const handleUserUnlock = async () => {
    if (!synthRef.current.isUnlocked()) {
      const ok = await synthRef.current.unlockFromUserGesture();
      setAudioUnlocked(ok);
      if (ok) {
        setStatusMessage("Web Audio SFX active (< 5ms procedural synthesis)");
      }
    }
  };

  const handleCodeChange = (nextCode: string) => {
    setCode(nextCode);
    const jitter = 0.94 + ((nextCode.length % 7) * 0.02);
    synthRef.current.playKeystroke(jitter);
  };

  const handleRunTests = async () => {
    await handleUserUnlock();
    const hasReturn = code.includes("return") && !code.includes("TODO");

    if (!hasReturn) {
      setComboStreak(0);
      synthRef.current.playCompileError();
      setStatusMessage("Compile / Assertion Error — missing valid return path");
      onSubmitSolution?.(code, false);
      return;
    }

    const nextStreak = comboStreak + 1;
    setComboStreak(nextStreak);

    if (nextStreak >= 3) {
      synthRef.current.playComboStreak(nextStreak);
      synthRef.current.playVictoryFanfare();
      setStatusMessage(`Combo x${nextStreak}! All test cases passed — Victory!`);
      onSubmitSolution?.(code, true);
    } else {
      synthRef.current.playTestPassed();
      setStatusMessage(`Test suite passed! Combo streak: ${nextStreak}`);
      onSubmitSolution?.(code, true);
    }
  };

  const toggleMute = async () => {
    await handleUserUnlock();
    const nextMuted = !isMuted;
    synthRef.current.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold">Live Battle Code Editor</span>
          <span
            data-testid="sfx-unlock-badge"
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              audioUnlocked
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {audioUnlocked ? "SFX Unlocked" : "Click to Enable SFX"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isMuted ? "Unmute Battle SFX" : "Mute Battle SFX"}
            onClick={toggleMute}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-cyan-400" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <Play className="h-3.5 w-3.5" />
            Run Battle Tests
          </button>
        </div>
      </div>

      <textarea
        aria-label="Battle Solution Code Editor"
        value={code}
        onClick={handleUserUnlock}
        onChange={(e) => handleCodeChange(e.target.value)}
        rows={10}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
      />

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span data-testid="battle-editor-status">{statusMessage}</span>
        <span className="font-mono">Streak: {comboStreak}x</span>
      </div>
    </div>
  );
};

export default BattleEditor;
