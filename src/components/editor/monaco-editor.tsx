"use client";

import React, { useEffect, useRef, useState } from "react";
import { NeuralAutocompleteEngine, InlineCompletionResponse } from "./neural-autocomplete";
import { Sparkles, Cpu, Zap, CheckCircle2 } from "lucide-react";

export interface MonacoEditorProps {
  initialCode?: string;
  language?: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  initialCode = "// Write your solution here\nfunction solve(input) {\n",
  language = "typescript",
  onChange,
  readOnly = false,
}) => {
  const [code, setCode] = useState(initialCode);
  const [suggestion, setSuggestion] = useState<string>("");
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [providerMode, setProviderMode] = useState<"wasm" | "webgpu">("wasm");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const engine = NeuralAutocompleteEngine.getInstance();

  useEffect(() => {
    engine.init().then((info) => {
      setProviderMode(info.provider);
    });
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    if (onChange) onChange(newCode);

    // Trigger debounced sub-30ms neural completion (50ms debounce)
    engine.debouncedPredict(
      {
        prefix: newCode,
        suffix: "",
        language,
      },
      (res: InlineCompletionResponse) => {
        setSuggestion(res.completion);
        setLastLatency(res.latencyMs);
      },
      50,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      const updated = code + suggestion;
      setCode(updated);
      setSuggestion("");
      if (onChange) onChange(updated);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden flex flex-col font-mono text-xs shadow-2xl">
      {/* Editor Header / AI Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/5 text-white/60">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
          <span className="ml-2 font-medium text-white/80">{language}.ts</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
            <Cpu className="w-3 h-3" />
            ONNX {providerMode.toUpperCase()}
          </div>

          {lastLatency !== null && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400">
              <Zap className="w-3 h-3" />
              {lastLatency}ms
            </div>
          )}
        </div>
      </div>

      {/* Editor Surface */}
      <div className="relative p-4 min-h-[260px] flex-1">
        {/* Ghost text overlay for Tab completion */}
        {suggestion && (
          <div
            aria-hidden="true"
            className="absolute top-4 left-4 right-4 pointer-events-none whitespace-pre-wrap font-mono text-xs text-white/30"
          >
            <span className="invisible">{code}</span>
            <span className="text-amber-400/70 border-b border-amber-400/40">
              {suggestion}
            </span>
            <span className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
              Tab ⇥
            </span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className="w-full h-full min-h-[220px] bg-transparent text-white font-mono text-xs focus:outline-none resize-none leading-relaxed"
        />
      </div>
    </div>
  );
};

