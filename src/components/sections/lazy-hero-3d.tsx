"use client";

import dynamic from "next/dynamic";
import React from "react";

export function Hero3DSkeleton() {
  return (
    <div
      aria-label="Loading 3D Cyber Arena..."
      className="relative min-h-[600px] w-full flex items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800 animate-pulse overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-blue-950/20" />
      <div className="flex flex-col items-center gap-4 z-10">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <span className="text-sm font-mono text-cyan-400/70 tracking-widest uppercase">
          Initializing 3D Shaders...
        </span>
      </div>
    </div>
  );
}

export const LazyHero3D = dynamic(
  () => import("./hero-3d").then((mod) => mod.Hero3D),
  {
    ssr: false,
    loading: () => <Hero3DSkeleton />,
  },
);

export default LazyHero3D;
