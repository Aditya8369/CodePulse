"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { CodeArenaEditorProps } from "./code-arena-editor";

export function CodeArenaEditorSkeleton() {
  return (
    <div
      aria-label="Loading Monaco Code Editor..."
      className="flex flex-col h-[520px] w-full rounded-xl border border-slate-800 bg-[#0d1117] overflow-hidden animate-pulse"
    >
      <div className="h-11 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <div className="w-3 h-3 rounded-full bg-slate-700" />
          <div className="w-24 h-4 rounded bg-slate-800 ml-3" />
        </div>
        <div className="w-20 h-7 rounded bg-slate-800" />
      </div>
      <div className="flex-1 p-4 space-y-3 font-mono">
        <div className="w-1/3 h-4 rounded bg-slate-800/80" />
        <div className="w-1/2 h-4 rounded bg-slate-800/60" />
        <div className="w-2/5 h-4 rounded bg-slate-800/60" />
        <div className="w-3/4 h-4 rounded bg-slate-800/50" />
        <div className="w-1/4 h-4 rounded bg-slate-800/70" />
      </div>
    </div>
  );
}

export const LazyCodeArenaEditor = dynamic<CodeArenaEditorProps>(
  () => import("./code-arena-editor").then((mod) => mod.CodeArenaEditor),
  {
    ssr: false,
    loading: () => <CodeArenaEditorSkeleton />,
  },
);

export default LazyCodeArenaEditor;
