"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ===========================
// Constants
// ===========================

/** How long the green check stays visible after a successful copy. */
export const COPIED_RESET_MS = 2000;

// ===========================
// Helpers
// ===========================

/**
 * Splits code into lines for display. A single trailing newline is dropped,
 * because it ends the last line rather than starting an empty one.
 */
export function splitCodeLines(code: string): string[] {
  const lines = code.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// ===========================
// Types
// ===========================

export interface BattleCodeSnippetProps {
  /** The code to show. Copying always copies exactly this string. */
  code: string;
  /** Shown in the badge, for example "typescript", "python" or "rust". */
  language?: string;
  /** Show the line number gutter. Defaults to true. */
  showLineNumbers?: boolean;
  className?: string;
}

// ===========================
// Component
// ===========================

/**
 * A dark code block with line numbers, a language badge and a one-click copy
 * button. Long lines scroll sideways inside the block, and the line numbers
 * stay in place while they do, so the block never widens the page.
 */
export function BattleCodeSnippet({
  code,
  language,
  showLineNumbers = true,
  className,
}: BattleCodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(resetTimer.current);
    };
  }, []);

  const lines = useMemo(() => splitCodeLines(code), [code]);
  const gutterDigits = String(lines.length).length;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      if (!mounted.current) return;
      clearTimeout(resetTimer.current);
      setCopied(true);
      toast.success("Code copied to clipboard!");
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // The Clipboard API is missing on insecure pages and can be blocked.
      if (mounted.current) toast.error("Could not copy the code.");
    }
  }

  const copyLabel = copied ? "Copied" : "Copy code";

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-lg",
        className
      )}
    >
      {/* Window bar: macOS-style dots, language badge and the copy button */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-red-500/80" />
            <span className="size-3 rounded-full bg-yellow-400/80" />
            <span className="size-3 rounded-full bg-green-500/80" />
          </div>
          {language && (
            <span className="truncate rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-medium lowercase text-slate-300">
              {language}
            </span>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger
            type="button"
            onClick={copyCode}
            aria-label="Copy code"
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary",
              copied
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            )}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            <span aria-hidden="true">{copied ? "Copied" : "Copy"}</span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            {copyLabel}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Announces the result to screen readers; the button label stays stable. */}
      <span role="status" className="sr-only">
        {copied ? "Code copied to clipboard" : ""}
      </span>

      {/* tabIndex lets keyboard users scroll a long line sideways. */}
      <pre
        tabIndex={0}
        aria-label={language ? `${language} code` : "Code"}
        className="m-0 overflow-x-auto py-3 font-mono text-[13px] leading-6 text-slate-200 [tab-size:2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <code className="block w-max min-w-full">
          {lines.map((line, index) => (
            <span key={index} className="flex" data-testid="code-line">
              {showLineNumbers && (
                <span
                  aria-hidden="true"
                  data-testid="line-number"
                  style={{ minWidth: `${gutterDigits + 3}ch` }}
                  className="sticky left-0 shrink-0 select-none bg-[#0d1117] pr-4 pl-3 text-right text-slate-500"
                >
                  {index + 1}
                </span>
              )}
              <span className={cn("whitespace-pre pr-4", !showLineNumbers && "pl-4")}>
                {/* An empty line still needs height, so it gets a space. */}
                {line === "" ? " " : line}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
