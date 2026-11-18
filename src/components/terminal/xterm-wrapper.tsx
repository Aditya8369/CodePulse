"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface XtermLine {
  id: string;
  segments: Array<{ text: string; className?: string }>;
}

export interface XtermHandle {
  write: (data: string) => void;
  writeln: (line: string) => void;
  clear: () => void;
  focus: () => void;
}

export interface XtermWrapperProps {
  prompt?: string;
  onCommand: (command: string) => void | Promise<void>;
  onInterrupt?: () => void;
  autocompleteCandidates?: string[];
  disabled?: boolean;
  className?: string;
}

const ANSI_COLOR_MAP: Record<string, string> = {
  "30": "text-slate-900",
  "31": "text-red-400",
  "32": "text-emerald-400",
  "33": "text-amber-300",
  "34": "text-sky-400",
  "35": "text-purple-400",
  "36": "text-cyan-400",
  "37": "text-slate-200",
  "90": "text-slate-500",
  "92": "text-emerald-300",
  "94": "text-blue-300",
  "96": "text-cyan-300",
};

export function parseAnsiSegments(
  input: string
): Array<{ text: string; className?: string }> {
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  const segments: Array<{ text: string; className?: string }> = [];
  let lastIndex = 0;
  let activeClass = "";
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: input.slice(lastIndex, match.index),
        className: activeClass || undefined,
      });
    }

    const codes = match[1].split(";").filter(Boolean);
    if (codes.length === 0 || codes.includes("0")) {
      activeClass = "";
    } else {
      const classes: string[] = [];
      for (const code of codes) {
        if (code === "1") classes.push("font-bold");
        if (ANSI_COLOR_MAP[code]) classes.push(ANSI_COLOR_MAP[code]);
      }
      activeClass = classes.join(" ");
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({
      text: input.slice(lastIndex),
      className: activeClass || undefined,
    });
  }

  return segments.length > 0 ? segments : [{ text: input }];
}

export const XtermWrapper = forwardRef<XtermHandle, XtermWrapperProps>(
  function XtermWrapper(
    {
      prompt = "$ ",
      onCommand,
      onInterrupt,
      autocompleteCandidates = [
        "ls",
        "cd",
        "pwd",
        "cat",
        "echo",
        "mkdir",
        "touch",
        "rm",
        "chmod",
        "grep",
        "wc",
        "head",
        "tail",
        "git",
        "python3",
        "curl",
        "vi",
        "clear",
        "uname",
        "help",
      ],
      disabled = false,
      className,
    },
    ref
  ) {
    const [lines, setLines] = useState<XtermLine[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const lineCounter = useRef(0);

    const appendLine = useCallback((text: string) => {
      const splitLines = text.split("\n");
      setLines((prev) => [
        ...prev,
        ...splitLines.map((l) => {
          lineCounter.current += 1;
          return {
            id: `xterm-line-${lineCounter.current}`,
            segments: parseAnsiSegments(l),
          };
        }),
      ]);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => appendLine(data),
        writeln: (line: string) => appendLine(line),
        clear: () => setLines([]),
        focus: () => inputRef.current?.focus(),
      }),
      [appendLine]
    );

    useEffect(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    }, [lines]);

    const handleSubmit = async () => {
      const cmd = inputValue;
      appendLine(`${prompt}${cmd}`);
      setInputValue("");
      if (cmd.trim()) {
        setHistory((prev) => [...prev, cmd]);
      }
      setHistoryIndex(-1);
      await onCommand(cmd);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await handleSubmit();
        return;
      }

      // Ctrl+L clears terminal viewport
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLines([]);
        return;
      }

      // Ctrl+C interrupts active line
      if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        appendLine(`${prompt}${inputValue}^C`);
        setInputValue("");
        onInterrupt?.();
        return;
      }

      // Up / Down command history navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        const nextIdx =
          historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputValue(history[nextIdx]);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        const nextIdx = historyIndex + 1;
        if (nextIdx >= history.length) {
          setHistoryIndex(-1);
          setInputValue("");
        } else {
          setHistoryIndex(nextIdx);
          setInputValue(history[nextIdx]);
        }
        return;
      }

      // Tab autocomplete
      if (e.key === "Tab") {
        e.preventDefault();
        const parts = inputValue.split(/\s+/);
        const prefix = parts[parts.length - 1] ?? "";
        if (!prefix) return;
        const match = autocompleteCandidates.find((c) => c.startsWith(prefix));
        if (match) {
          parts[parts.length - 1] = match;
          setInputValue(parts.join(" "));
        }
      }
    };

    return (
      <div
        ref={viewportRef}
        onClick={() => inputRef.current?.focus()}
        data-testid="xterm-terminal-viewport"
        className={cn(
          "font-mono text-xs sm:text-sm leading-relaxed",
          "bg-[#050811] text-slate-200 rounded-xl border border-white/10 p-4",
          "h-80 overflow-y-auto cursor-text select-text",
          className
        )}
      >
        {lines.map((line) => (
          <div key={line.id} className="whitespace-pre-wrap break-words min-h-[1.25rem]">
            {line.segments.map((seg, i) => (
              <span key={i} className={seg.className}>
                {seg.text}
              </span>
            ))}
          </div>
        ))}

        <div className="flex items-center gap-1.5 mt-1">
          <span className="shrink-0 whitespace-pre">
            {parseAnsiSegments(prompt).map((seg, idx) => (
              <span key={idx} className={seg.className}>
                {seg.text}
              </span>
            ))}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            disabled={disabled}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Linux terminal command input"
            data-testid="xterm-command-input"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-slate-100 outline-none caret-emerald-400"
          />
        </div>
      </div>
    );
  }
);
