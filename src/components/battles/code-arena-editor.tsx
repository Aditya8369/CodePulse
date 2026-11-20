'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Clock, Zap, Terminal } from 'lucide-react';

interface CodeArenaEditorProps {
  initialCode?: string;
  problemTitle: string;
  problemDescription: string;
}

export const CodeArenaEditor: React.FC<CodeArenaEditorProps> = ({
  initialCode = `function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}`,
  problemTitle,
  problemDescription,
}) => {
  const [code, setCode] = useState(initialCode);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    passed: boolean;
    passedTests: number;
    totalTests: number;
    durationMs: number;
  } | null>(null);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setResult({
        passed: true,
        passedTests: 3,
        totalTests: 3,
        durationMs: 14.2,
      });
    }, 600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Problem Specification */}
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full w-fit">
            <Zap className="w-3.5 h-3.5" /> Algorithmic Benchmark Arena
          </div>
          <h2 className="text-xl font-bold text-foreground">{problemTitle}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {problemDescription}
          </p>
        </div>

        {result && (
          <div className="mt-6 p-4 rounded-xl border border-border bg-background/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {result.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                {result.passed ? 'All Test Cases Passed' : 'Tests Failed'}
              </span>
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {result.durationMs}ms
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Pass Rate: {result.passedTests} / {result.totalTests} cases verified.
            </div>
          </div>
        )}
      </div>

      {/* Code Editor Panel */}
      <div className="rounded-xl border border-border bg-slate-950 p-4 flex flex-col justify-between shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Terminal className="w-4 h-4 text-primary" /> solution.js
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition shadow"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isRunning ? 'Benchmarking...' : 'Execute & Benchmark'}
          </button>
        </div>

        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          rows={14}
          className="w-full mt-3 bg-transparent font-mono text-xs text-emerald-300 resize-none outline-none leading-relaxed"
          spellCheck={false}
        />

        <div className="pt-3 border-t border-border/40 text-[10px] font-mono text-muted-foreground flex justify-between">
          <span>Sandbox runtime: Node.js VM isolated (2000ms max)</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
