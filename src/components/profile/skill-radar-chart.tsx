"use client";

import React, { useMemo, useState } from "react";
import { Compass, Sparkles } from "lucide-react";

export const RADAR_COMPETENCY_AXES = [
  "Algorithms",
  "Concurrency",
  "Frontend",
  "Security",
  "DevOps",
  "Cryptography",
  "Database",
  "Networking",
  "Clean Code",
  "Performance",
  "Testing",
  "System Design",
] as const;

export type RadarCompetencyAxis = (typeof RADAR_COMPETENCY_AXES)[number];

export interface RadarVertexPoint {
  axis: RadarCompetencyAxis;
  index: number;
  score: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

export function computeRadarVertices(
  scores: Partial<Record<RadarCompetencyAxis, number>>,
  center = 200,
  maxRadius = 135
): RadarVertexPoint[] {
  const totalAxes = RADAR_COMPETENCY_AXES.length;

  return RADAR_COMPETENCY_AXES.map((axis, index) => {
    const rawScore = scores[axis] ?? 0;
    const clamped = Math.max(0, Math.min(100, rawScore));
    const angleRad = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
    const r = (clamped / 100) * maxRadius;
    const labelR = maxRadius + 26;

    return {
      axis,
      index,
      score: clamped,
      x: Number((center + r * Math.cos(angleRad)).toFixed(2)),
      y: Number((center + r * Math.sin(angleRad)).toFixed(2)),
      labelX: Number((center + labelR * Math.cos(angleRad)).toFixed(2)),
      labelY: Number((center + labelR * Math.sin(angleRad)).toFixed(2)),
    };
  });
}

export interface SkillRadarChartProps {
  username: string;
  scores: Partial<Record<RadarCompetencyAxis, number>>;
  comparisonScores?: Partial<Record<RadarCompetencyAxis, number>>;
  comparisonLabel?: string;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  username,
  scores,
  comparisonScores,
  comparisonLabel = "Peer Benchmark",
}) => {
  const [hoveredAxis, setHoveredAxis] = useState<RadarVertexPoint | null>(null);

  const primaryVertices = useMemo(() => computeRadarVertices(scores), [scores]);
  const comparisonVertices = useMemo(
    () => (comparisonScores ? computeRadarVertices(comparisonScores) : null),
    [comparisonScores]
  );

  const primaryPolygon = useMemo(
    () => primaryVertices.map((v) => `${v.x},${v.y}`).join(" "),
    [primaryVertices]
  );

  const comparisonPolygon = useMemo(
    () =>
      comparisonVertices
        ? comparisonVertices.map((v) => `${v.x},${v.y}`).join(" ")
        : null,
    [comparisonVertices]
  );

  const topThree = useMemo(() => {
    return [...primaryVertices].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [primaryVertices]);

  return (
    <section
      aria-label="12-Dimensional Developer Skill Radar Chart"
      className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold tracking-tight">
              12-Axis Engineering Skill Fingerprint
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Developer: <span className="font-mono text-zinc-200">@{username}</span> • Hover any
            vertex to inspect competency score
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {topThree.map((item) => (
            <span
              key={item.axis}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[11px] text-cyan-300"
            >
              <Sparkles className="h-3 w-3" />
              {item.axis}: {item.score}
            </span>
          ))}
        </div>
      </div>

      {/* Hover Tooltip Banner */}
      <div
        data-testid="radar-axis-tooltip"
        className="min-h-[34px] rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-1.5 text-xs"
      >
        {hoveredAxis ? (
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300">{hoveredAxis.axis}</span>
            <span className="font-mono font-bold text-white">
              Proficiency: {hoveredAxis.score} / 100
            </span>
          </div>
        ) : (
          <span className="text-zinc-400">
            Hover or focus on any of the 12 competency nodes to inspect calibrated scores.
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <svg
          data-testid="skill-radar-svg"
          viewBox="0 0 400 400"
          className="h-80 w-80 max-w-full overflow-visible"
        >
          {/* Concentric scale rings (25%, 50%, 75%, 100%) */}
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <circle
              key={scale}
              cx={200}
              cy={200}
              r={135 * scale}
              fill="none"
              stroke="#27272a"
              strokeDasharray={scale < 1 ? "3 3" : undefined}
              strokeWidth="1"
            />
          ))}

          {/* Radial spokes + Axis Labels */}
          {primaryVertices.map((v) => {
            const outerAngle = (Math.PI * 2 * v.index) / 12 - Math.PI / 2;
            const spokeX = 200 + 135 * Math.cos(outerAngle);
            const spokeY = 200 + 135 * Math.sin(outerAngle);

            return (
              <g key={v.axis}>
                <line
                  x1={200}
                  y1={200}
                  x2={spokeX}
                  y2={spokeY}
                  stroke="#27272a"
                  strokeWidth="1"
                />
                <text
                  x={v.labelX}
                  y={v.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={hoveredAxis?.axis === v.axis ? "#22d3ee" : "#a1a1aa"}
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {v.axis}
                </text>
              </g>
            );
          })}

          {/* Optional Peer/Team Overlay Polygon */}
          {comparisonPolygon && (
            <polygon
              data-testid="radar-comparison-polygon"
              points={comparisonPolygon}
              fill="rgba(168, 85, 247, 0.14)"
              stroke="#a855f7"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Primary Developer Competency Polygon */}
          <polygon
            data-testid="radar-primary-polygon"
            points={primaryPolygon}
            fill="rgba(34, 211, 238, 0.24)"
            stroke="#22d3ee"
            strokeWidth="2.5"
          />

          {/* Interactive Vertex Nodes */}
          {primaryVertices.map((v) => (
            <circle
              key={`node-${v.axis}`}
              data-testid={`radar-node-${v.axis}`}
              cx={v.x}
              cy={v.y}
              r={hoveredAxis?.axis === v.axis ? 6.5 : 4.5}
              fill={hoveredAxis?.axis === v.axis ? "#f0abfc" : "#22d3ee"}
              stroke="#09090b"
              strokeWidth="1.5"
              tabIndex={0}
              role="button"
              aria-label={`${v.axis}: ${v.score}`}
              onMouseEnter={() => setHoveredAxis(v)}
              onFocus={() => setHoveredAxis(v)}
              onMouseLeave={() => setHoveredAxis(null)}
              className="cursor-pointer outline-none"
            />
          ))}
        </svg>
      </div>

      {comparisonLabel && comparisonPolygon && (
        <div className="flex justify-center gap-4 text-[11px] text-zinc-400">
          <span className="text-cyan-400">■ @{username}</span>
          <span className="text-purple-400">■ {comparisonLabel}</span>
        </div>
      )}
    </section>
  );
};

export default SkillRadarChart;
