"use client";

import React, { useState } from "react";
import { Download, Mic, MicOff, Radio, Volume2, X } from "lucide-react";

export interface CodeLineEntry {
  lineNumber: number;
  content: string;
}

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceAssistantModalProps {
  isOpen: boolean;
  filePath: string;
  codeLines: CodeLineEntry[];
  highlightStartLine: number;
  highlightEndLine: number;
  waveformAmplitudes?: number[];
  transcript?: TranscriptEntry[];
  onClose?: () => void;
  onExportTranscript?: (formattedText: string) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  filePath,
  codeLines,
  highlightStartLine,
  highlightEndLine,
  waveformAmplitudes = [18, 42, 76, 64, 92, 55, 84, 38, 68, 45, 29, 60],
  transcript = [
    {
      role: "user",
      text: "How does the transaction retry loop handle lock contention here?",
    },
    {
      role: "assistant",
      text: "Lines 14–18 wrap the Prisma transaction in exponential backoff with full jitter to recover 40P01 deadlocks automatically.",
    },
  ],
  onClose,
  onExportTranscript,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [exportedText, setExportedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    const formatted = [
      `# CodePulse Voice Architecture Session — ${filePath}`,
      `Highlighted Lines: L${highlightStartLine}–L${highlightEndLine}`,
      "",
      ...transcript.map(
        (entry) => `[${entry.role.toUpperCase()}]: ${entry.text}`,
      ),
    ].join("\n");

    setExportedText(formatted);
    onExportTranscript?.(formatted);

    if (typeof window !== "undefined" && typeof URL.createObjectURL === "function") {
      try {
        const blob = new Blob([formatted], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "codepulse-voice-transcript.txt";
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // Ignore in headless test environments
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Real-Time Voice Codebase Architecture Assistant"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-4xl flex-col gap-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Interactive Codebase Architecture Voice Agent
              </h2>
              <p className="font-mono text-xs text-zinc-400">
                {filePath} · Highlighting L{highlightStartLine}–L{highlightEndLine}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close voice assistant modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Audio Waveform Visualizer */}
        <div
          data-testid="voice-waveform"
          className="flex h-16 items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-6"
        >
          {waveformAmplitudes.map((amp, idx) => {
            const effectiveHeight = isMuted ? 12 : pushToTalkActive ? Math.min(100, amp + 15) : amp;
            return (
              <span
                key={idx}
                style={{ height: `${effectiveHeight}%` }}
                className={`w-1.5 rounded-full transition-all ${
                  isMuted
                    ? "bg-zinc-600"
                    : pushToTalkActive
                      ? "bg-emerald-400"
                      : "bg-cyan-400"
                }`}
              />
            );
          })}
        </div>

        {/* Synchronized Code Highlights & Dialogue Transcript */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Synchronized Editor Window
            </div>
            <div className="space-y-1">
              {codeLines.map((line) => {
                const isHighlighted =
                  line.lineNumber >= highlightStartLine &&
                  line.lineNumber <= highlightEndLine;
                return (
                  <div
                    key={line.lineNumber}
                    data-testid={`code-line-${line.lineNumber}`}
                    data-highlighted={isHighlighted ? "true" : "false"}
                    className={`flex gap-3 rounded px-2 py-0.5 ${
                      isHighlighted
                        ? "border-l-2 border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "text-zinc-400"
                    }`}
                  >
                    <span className="w-6 select-none text-right text-zinc-500">
                      {line.lineNumber}
                    </span>
                    <span className="truncate">{line.content}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs">
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Live Voice Dialogue Transcript
              </div>
              {transcript.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-3 py-2 ${
                    item.role === "assistant"
                      ? "bg-indigo-500/15 text-indigo-100"
                      : "bg-zinc-800/80 text-zinc-200"
                  }`}
                >
                  <span className="mr-1.5 font-mono text-[10px] font-bold uppercase text-cyan-400">
                    {item.role}:
                  </span>
                  {item.text}
                </div>
              ))}
            </div>

            {exportedText && (
              <div
                data-testid="transcript-export-status"
                className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300"
              >
                Transcript exported ({exportedText.length} chars)
              </div>
            )}
          </div>
        </div>

        {/* Controls: Mute, Push-to-Talk & Export Transcript */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="voice-mute-btn"
              onClick={() => setIsMuted((m) => !m)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                isMuted
                  ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-200"
              }`}
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {isMuted ? "Unmute Mic" : "Mute Mic"}
            </button>

            <button
              type="button"
              data-testid="voice-ptt-btn"
              onMouseDown={() => setPushToTalkActive(true)}
              onMouseUp={() => setPushToTalkActive(false)}
              onClick={() => setPushToTalkActive((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                pushToTalkActive
                  ? "border-emerald-500/40 bg-emerald-600 text-white"
                  : "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {pushToTalkActive ? "Transmitting (Push-to-Talk)" : "Push to Talk"}
            </button>
          </div>

          <button
            type="button"
            data-testid="voice-export-btn"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export Transcript
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantModal;
