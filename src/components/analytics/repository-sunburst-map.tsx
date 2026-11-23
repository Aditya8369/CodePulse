"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FolderTree, GitBranch, Users } from "lucide-react";

export interface SunburstContributor {
  authorId: string;
  authorName: string;
  ownershipPercent: number;
  lastCommitDaysAgo: number;
}

export interface SunburstDirectoryNode {
  directoryPath: string;
  name: string;
  totalDecayedWeight: number;
  busFactor: number;
  isCriticalBusFactorRisk: boolean;
  riskReason?: string | null;
  contributors: SunburstContributor[];
  children: SunburstDirectoryNode[];
}

export interface RepositorySunburstMapProps {
  rootNode: SunburstDirectoryNode;
  recommendations?: Array<{
    directoryPath: string;
    priority: string;
    actionItem: string;
  }>;
}

const SLICE_COLORS = ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"];

export const RepositorySunburstMap: React.FC<RepositorySunburstMapProps> = ({
  rootNode,
  recommendations = [],
}) => {
  const [drillPath, setDrillPath] = useState<string[]>([rootNode.directoryPath]);

  const activeNode = useMemo(() => {
    let curr: SunburstDirectoryNode = rootNode;
    for (let i = 1; i < drillPath.length; i++) {
      const next = curr.children.find((c) => c.directoryPath === drillPath[i]);
      if (next) curr = next;
    }
    return curr;
  }, [rootNode, drillPath]);

  // Compute SVG sunburst arc segments for immediate children of activeNode
  const sunburstArcs = useMemo(() => {
    const items = activeNode.children.length > 0 ? activeNode.children : [activeNode];
    const totalW =
      items.reduce((acc, item) => acc + Math.max(1, item.totalDecayedWeight), 0) || 1;
    let currentAngle = -Math.PI / 2;
    const cx = 140;
    const cy = 140;
    const rOuter = 115;
    const rInner = 54;

    return items.map((item, idx) => {
      const fraction = Math.max(1, item.totalDecayedWeight) / totalW;
      const sweep = Math.min(Math.PI * 1.999, fraction * Math.PI * 2);
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      currentAngle = endAngle;

      const x1 = cx + rOuter * Math.cos(startAngle);
      const y1 = cy + rOuter * Math.sin(startAngle);
      const x2 = cx + rOuter * Math.cos(endAngle);
      const y2 = cy + rOuter * Math.sin(endAngle);
      const x3 = cx + rInner * Math.cos(endAngle);
      const y3 = cy + rInner * Math.sin(endAngle);
      const x4 = cx + rInner * Math.cos(startAngle);
      const y4 = cy + rInner * Math.sin(startAngle);
      const largeArc = sweep > Math.PI ? 1 : 0;

      const d = [
        `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
        "Z",
      ].join(" ");

      return {
        node: item,
        pathData: d,
        fill: item.isCriticalBusFactorRisk
          ? "#ef4444"
          : SLICE_COLORS[idx % SLICE_COLORS.length],
        percent: Math.round(fraction * 100),
      };
    });
  }, [activeNode]);

  const handleDrillDown = (child: SunburstDirectoryNode) => {
    if (child.directoryPath !== activeNode.directoryPath) {
      setDrillPath((prev) => [...prev, child.directoryPath]);
    }
  };

  return (
    <section
      aria-label="Repository Temporal Ownership Sunburst Map"
      className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100"
    >
      {/* Header + Drill-down Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold tracking-tight">
              Temporal Code Ownership & Bus Factor Sunburst
            </h2>
          </div>
          <nav
            aria-label="Directory Breadcrumb"
            className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-xs text-zinc-400"
          >
            {drillPath.map((p, idx) => (
              <React.Fragment key={p}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />}
                <button
                  type="button"
                  onClick={() => setDrillPath(drillPath.slice(0, idx + 1))}
                  className="rounded px-1.5 py-0.5 hover:bg-zinc-800 hover:text-cyan-300"
                >
                  {p === "." ? rootNode.name : p}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs">
          <Users className="h-3.5 w-3.5 text-emerald-400" />
          <span>Active Bus Factor:</span>
          <span
            data-testid="active-bus-factor"
            className={`font-bold ${
              activeNode.isCriticalBusFactorRisk ? "text-red-400" : "text-emerald-300"
            }`}
          >
            {activeNode.busFactor}
          </span>
        </div>
      </div>

      {/* Critical Bus Factor Risk Banner */}
      {activeNode.isCriticalBusFactorRisk && activeNode.riskReason && (
        <div
          data-testid="bus-factor-risk-alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-xs text-red-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{activeNode.riskReason}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Interactive SVG Sunburst */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <svg
            data-testid="ownership-sunburst-svg"
            viewBox="0 0 280 280"
            className="h-64 w-64"
          >
            {sunburstArcs.map((arc) => (
              <path
                key={arc.node.directoryPath}
                data-testid={`sunburst-slice-${arc.node.name}`}
                d={arc.pathData}
                fill={arc.fill}
                fillOpacity={0.85}
                stroke="#09090b"
                strokeWidth="2"
                onClick={() => handleDrillDown(arc.node)}
                className="cursor-pointer transition-opacity hover:opacity-100"
              >
                <title>
                  {arc.node.name} ({arc.percent}% weight • Bus Factor {arc.node.busFactor})
                </title>
              </path>
            ))}
            <text
              x="140"
              y="136"
              textAnchor="middle"
              fill="#f4f4f5"
              fontSize="12"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {activeNode.name}
            </text>
            <text
              x="140"
              y="154"
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize="10"
              fontFamily="monospace"
            >
              BF: {activeNode.busFactor}
            </text>
          </svg>
        </div>

        {/* Subdirectory Drill-Down List & Contributor Shares */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Subdirectories & Semantic Ownership
          </h3>
          {activeNode.children.length > 0 ? (
            <div className="flex flex-col gap-2">
              {activeNode.children.map((child) => (
                <button
                  key={child.directoryPath}
                  type="button"
                  data-testid={`drill-dir-${child.name}`}
                  onClick={() => handleDrillDown(child)}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${
                    child.isCriticalBusFactorRisk
                      ? "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      : "border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:border-cyan-500/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="font-mono font-semibold">{child.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>BF: {child.busFactor}</span>
                    {child.isCriticalBusFactorRisk && (
                      <span className="rounded bg-red-500/30 px-1.5 py-0.5 text-red-200">
                        HIGH RISK
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeNode.contributors.map((c) => (
                <div
                  key={c.authorId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-white">{c.authorName}</span>
                  <span className="font-mono text-cyan-300">
                    {c.ownershipPercent}% ({c.lastCommitDaysAgo}d ago)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-zinc-800 pt-3 text-xs text-zinc-300">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">
            Onboarding Knowledge-Sharing Recommendations
          </span>
          {recommendations.map((r) => (
            <div key={r.directoryPath} className="rounded-lg bg-zinc-900/70 px-3 py-2">
              <span className="font-mono font-bold text-amber-300">[{r.priority}]</span>{" "}
              {r.actionItem}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RepositorySunburstMap;
