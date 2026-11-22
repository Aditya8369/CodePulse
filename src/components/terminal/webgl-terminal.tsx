'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  Sparkles,
  CornerDownLeft,
  ChevronRight,
  Code2,
  Cpu,
  Trash2,
  Layers,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'compiler' | 'git' | 'docker' | 'system' | 'esports';
}

const COMMAND_CATALOG: CommandSuggestion[] = [
  { command: 'help', description: 'Show all available PTY shell utilities', category: 'system' },
  { command: 'clear', description: 'Clear terminal viewport history buffer', category: 'system' },
  { command: 'history', description: 'Display recent executed command log', category: 'system' },
  { command: 'status', description: 'Inspect WebGL sandbox container cgroups and memory', category: 'system' },
  { command: 'cargo test --release', description: 'Execute Rust test benchmark suite', category: 'compiler' },
  { command: 'cargo build', description: 'Compile crate intermediate artifacts', category: 'compiler' },
  { command: 'node benchmark.js', description: 'Run V8 algorithmic execution benchmark', category: 'compiler' },
  { command: 'python3 -m unittest', description: 'Run Python test suite runner', category: 'compiler' },
  { command: 'go run main.go', description: 'Compile and run Go entrypoint service', category: 'compiler' },
  { command: 'git status', description: 'Check branch changes and untracked files', category: 'git' },
  { command: 'git log -n 5', description: 'Show recent 5 commit hashes', category: 'git' },
  { command: 'docker compose ps', description: 'Inspect isolated runner microservice containers', category: 'docker' },
  { command: 'battle run-test', description: 'Verify current solution against battle test cases', category: 'esports' },
];

export interface WebglTerminalProps {
  sessionId?: string;
  userId?: string;
  initialHistory?: string[];
  onCommandExecute?: (cmd: string) => void;
  className?: string;
}

export const WebglTerminal: React.FC<WebglTerminalProps> = ({
  sessionId = 'demo-session',
  userId = 'anonymous-dev',
  initialHistory = [
    'cargo test --release',
    'node benchmark.js',
    'git status',
  ],
  onCommandExecute,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lines, setLines] = useState<string[]>([
    'CodePulse Ephemeral WebGL PTY Shell [v2.4.0]',
    'Isolated Linux Container (cgroups v2, seccomp-bpf enabled)',
    'Press Tab to autocomplete suggestions, or ↑/↓ for command history.',
    'Type "help" to view supported compiler & system commands.',
    '$ ',
  ]);

  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>(initialHistory);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(0);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Compute live auto-suggestions based on current input
  const suggestions = useMemo(() => {
    const trimmed = currentInput.trim().toLowerCase();
    if (!trimmed) return [];
    return COMMAND_CATALOG.filter((item) =>
      item.command.toLowerCase().startsWith(trimmed)
    ).slice(0, 5);
  }, [currentInput]);

  // Keep suggestion index within bounds
  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [suggestions]);

  // Scroll to bottom when lines update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const applySuggestion = (cmd: string) => {
    setCurrentInput(cmd);
    inputRef.current?.focus();
  };

  const executeCommand = useCallback(
    (rawCommand: string) => {
      const command = rawCommand.trim();
      const newLines = [...lines];
      newLines[newLines.length - 1] = `$ ${rawCommand}`;

      if (command.length > 0) {
        setCommandHistory((prev) => [command, ...prev.filter((c) => c !== command)]);
        setHistoryIndex(-1);
      }

      if (command === 'clear') {
        setLines(['$ ']);
        setCurrentInput('');
        return;
      }

      if (command === 'help') {
        newLines.push('Available commands:');
        COMMAND_CATALOG.forEach((item) => {
          newLines.push(`  ${item.command.padEnd(24)} - ${item.description}`);
        });
        newLines.push('$ ');
      } else if (command === 'history') {
        newLines.push('Recent Command History:');
        commandHistory.forEach((c, idx) => {
          newLines.push(`  ${String(idx + 1).padStart(3)}: ${c}`);
        });
        newLines.push('$ ');
      } else if (command === 'status') {
        newLines.push('[Container Health Telemetry]');
        newLines.push('  Engine: WebAssembly V8 JIT isolated runtime');
        newLines.push('  Memory Allocated: 14.2 MB / 64 MB (22%)');
        newLines.push('  CPU Fuel Consumed: 1,840 instructions');
        newLines.push('  PTY Socket Latency: 2.4ms (Edge AP-South)');
        newLines.push('$ ');
      } else if (command.length > 0) {
        newLines.push(`[pty-exec] ${command}: executed successfully (exit code 0, 8.4ms)`);
        newLines.push('$ ');
      } else {
        newLines.push('$ ');
      }

      setLines(newLines);
      setCurrentInput('');
      onCommandExecute?.(command);
    },
    [lines, commandHistory, onCommandExecute]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const target = suggestions[activeSuggestionIndex]?.command || suggestions[0].command;
        applySuggestion(target);
      }
      return;
    }

    // Enter execution
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        // If a suggestion is focused in popup, choose it or execute current input
      }
      executeCommand(currentInput);
      return;
    }

    // Up Arrow: History traversal or suggestion navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 1) {
        setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (commandHistory.length > 0) {
        const nextIdx = Math.min(commandHistory.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        setCurrentInput(commandHistory[nextIdx]);
      }
      return;
    }

    // Down Arrow: History traversal or suggestion navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 1) {
        setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCurrentInput(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
      return;
    }

    // Escape closes suggestions
    if (e.key === 'Escape') {
      setCurrentInput('');
    }
  };

  const handleClearTerminal = () => {
    setLines(['$ ']);
    setCurrentInput('');
    toast.info('Terminal buffer cleared');
  };

  return (
    <div
      data-testid="webgl-terminal-container"
      className={cn(
        'rounded-2xl border border-white/10 bg-[#090D16] font-mono shadow-2xl flex flex-col overflow-hidden relative text-slate-200 select-text',
        isFullScreen ? 'fixed inset-4 z-50' : 'h-[380px]',
        className
      )}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-300 font-medium">pty-sandbox://{sessionId}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            WebGL 60fps
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* History Drawer Toggle Button */}
          <button
            type="button"
            data-testid="toggle-history-btn"
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            className="text-slate-400 hover:text-white p-1 rounded transition text-xs flex items-center gap-1 cursor-pointer"
            title="Command History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">History</span>
          </button>

          {/* Clear Buffer Button */}
          <button
            type="button"
            data-testid="clear-terminal-btn"
            onClick={handleClearTerminal}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
            title="Clear Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Full Screen Toggle */}
          <button
            type="button"
            data-testid="fullscreen-terminal-btn"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Main Content Pane */}
      <div
        ref={terminalRef}
        data-testid="terminal-viewport"
        className="flex-1 p-4 overflow-y-auto space-y-1 text-xs select-text scrollbar-thin scrollbar-thumb-white/10"
      >
        {lines.slice(0, -1).map((line, idx) => (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed">
            {line}
          </div>
        ))}

        {/* Active Command Input Line with Prompt */}
        <div className="flex items-center gap-1 relative">
          <span className="text-emerald-400 font-bold">$</span>
          <input
            ref={inputRef}
            data-testid="terminal-command-input"
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent border-none outline-none text-emerald-300 font-mono text-xs p-0 m-0"
          />

          {/* Inline Ghost Suggestion Hint */}
          {suggestions.length > 0 && currentInput.length > 0 && (
            <span className="absolute left-[calc(1ch+8px)] pointer-events-none text-slate-500 font-mono text-xs opacity-50">
              {suggestions[0].command.slice(currentInput.length)}
            </span>
          )}
        </div>
      </div>

      {/* Auto-Suggestion Floating Popup */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            data-testid="command-suggestion-popup"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute left-6 bottom-10 z-40 w-80 rounded-xl border border-indigo-500/30 bg-[#0B0F19]/95 backdrop-blur-xl p-2 shadow-2xl space-y-1"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-indigo-400 px-2 py-0.5 border-b border-white/5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Auto-Suggestions
              </span>
              <span>[Tab] to complete</span>
            </div>

            <div className="space-y-0.5 pt-1">
              {suggestions.map((s, idx) => (
                <div
                  key={s.command}
                  data-testid={`suggestion-item-${idx}`}
                  onClick={() => applySuggestion(s.command)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors',
                    idx === activeSuggestionIndex
                      ? 'bg-indigo-600/30 text-white border border-indigo-500/40'
                      : 'hover:bg-white/5 text-slate-300'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="font-bold text-white truncate">{s.command}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{s.category}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command History Drawer Panel */}
      <AnimatePresence>
        {isHistoryDrawerOpen && (
          <motion.div
            data-testid="terminal-history-drawer"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-0 top-10 bottom-0 w-64 bg-[#080C14]/95 border-l border-white/10 p-3 z-30 flex flex-col justify-between shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-2 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 pb-2 border-b border-white/10">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Command History
                </span>
                <span className="text-[10px] text-slate-400">{commandHistory.length} items</span>
              </div>

              <div className="space-y-1">
                {commandHistory.map((cmd, idx) => (
                  <button
                    key={`${cmd}-${idx}`}
                    type="button"
                    onClick={() => {
                      setCurrentInput(cmd);
                      setIsHistoryDrawerOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left p-1.5 rounded-lg text-[11px] font-mono text-slate-300 hover:text-white hover:bg-white/5 transition-colors truncate block"
                  >
                    $ {cmd}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between font-mono">
              <span>Click item to insert</span>
              <span>↑/↓ cycle</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Footer Quick-Action Chips */}
      <div className="px-4 py-2 border-t border-white/5 bg-black/30 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-slate-500 text-[10px] uppercase font-mono mr-1">Quick:</span>
          {['help', 'cargo test', 'git status', 'status'].map((qCmd) => (
            <button
              key={qCmd}
              type="button"
              data-testid={`quick-cmd-${qCmd.replace(/\s+/g, '-')}`}
              onClick={() => executeCommand(qCmd)}
              className="px-2 py-0.5 rounded-md bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 font-mono text-[10px] border border-white/5 transition-colors cursor-pointer"
            >
              {qCmd}
            </button>
          ))}
        </div>

        <div className="text-[10px] font-mono text-slate-500 shrink-0">
          PTY Session: Active
        </div>
      </div>
    </div>
  );
};
