"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  FileCode,
  Flame,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Wrench,
} from "lucide-react";

export type SqaleRating = "A" | "B" | "C" | "D" | "E";

export interface HotspotFileItem {
  rank: number;
  filePath: string;
  maintainabilityIndex: number; // 0 to 100
  cyclomaticComplexity: number;
  halsteadDifficulty: number;
  loc: number;
  churnVelocity: number;
  bugFixRatio: number;
  hotspotScore: number;
  riskSeverity: "CRITICAL" | "HIGH" | "MEDIUM";
  recommendations: string[];
}

export interface TimelineDataPoint {
  label: string; // e.g., "Day 0", "Day 5", "Month +1"
  offset: number;
  maintainabilityIndex: number;
  confidenceLow: number;
  confidenceHigh: number;
  isForecast: boolean;
  debtHours?: number;
}

export interface TechnicalDebtChartProps {
  repositoryId?: string;
  repositoryName?: string;
  initialMaintainabilityIndex?: number;
  initialRating?: SqaleRating;
  initialTimeline?: TimelineDataPoint[];
  initialHotspots?: HotspotFileItem[];
}

const DEFAULT_HOTSPOTS: HotspotFileItem[] = [
  {
    rank: 1,
    filePath: "src/modules/battles/battles.gateway.ts",
    maintainabilityIndex: 41.2,
    cyclomaticComplexity: 38,
    halsteadDifficulty: 28.4,
    loc: 840,
    churnVelocity: 24.5,
    bugFixRatio: 0.44,
    hotspotScore: 184.2,
    riskSeverity: "CRITICAL",
    recommendations: [
      "Decompose nested conditionals into polymorphic Strategy pattern handlers.",
      "Extract WebSocket frame encoding and connection lifecycle into separate services.",
      "Backfill property-based fuzz tests to prevent bug-fix regressions.",
    ],
  },
  {
    rank: 2,
    filePath: "src/modules/sync/github-sync.processor.ts",
    maintainabilityIndex: 48.6,
    cyclomaticComplexity: 29,
    halsteadDifficulty: 24.1,
    loc: 620,
    churnVelocity: 18.2,
    bugFixRatio: 0.38,
    hotspotScore: 132.8,
    riskSeverity: "CRITICAL",
    recommendations: [
      "Break monolithic queue consumer into isolated batch pipeline stages.",
      "Replace switch/case trees with declarative lookup tables.",
      "Synthesize unit test fixtures for edge-case HTTP 429 backoff handling.",
    ],
  },
  {
    rank: 3,
    filePath: "src/modules/security/mpc-vault.service.ts",
    maintainabilityIndex: 54.1,
    cyclomaticComplexity: 24,
    halsteadDifficulty: 21.0,
    loc: 480,
    churnVelocity: 12.0,
    bugFixRatio: 0.28,
    hotspotScore: 89.4,
    riskSeverity: "HIGH",
    recommendations: [
      "Separate Shamir polynomial math from cryptographic persistence and audit logging.",
      "Simplify compound expressions with explicit intermediate immutable variables.",
    ],
  },
  {
    rank: 4,
    filePath: "src/modules/analytics/stream-aggregator.service.ts",
    maintainabilityIndex: 58.7,
    cyclomaticComplexity: 21,
    halsteadDifficulty: 18.5,
    loc: 510,
    churnVelocity: 14.8,
    bugFixRatio: 0.22,
    hotspotScore: 76.5,
    riskSeverity: "HIGH",
    recommendations: [
      "Isolate sliding window memory management into a zero-copy circular ring buffer.",
      "Add boundary unit tests for micro-batch tumble window transitions.",
    ],
  },
  {
    rank: 5,
    filePath: "src/common/resilience/circuit-breaker.service.ts",
    maintainabilityIndex: 63.4,
    cyclomaticComplexity: 18,
    halsteadDifficulty: 15.2,
    loc: 390,
    churnVelocity: 9.6,
    bugFixRatio: 0.18,
    hotspotScore: 54.1,
    riskSeverity: "MEDIUM",
    recommendations: [
      "Extract error-rate sliding window counter into an atomic bitmask.",
      "Review PR review cycles and decouple state machine transitions from logging.",
    ],
  },
];

export function build30DayDegradationSeries(baseMi: number, simulatedRefactoring = false): TimelineDataPoint[] {
  const points: TimelineDataPoint[] = [];
  const effectiveMi = simulatedRefactoring ? Math.min(95, baseMi + 8.5) : baseMi;
  const slope = simulatedRefactoring ? -0.04 : -0.12;

  for (let day = 0; day <= 30; day += 3) {
    const mi = Math.max(20, Math.min(100, effectiveMi + day * slope));
    const ciWidth = 1.2 + (day / 30) * 3.5;
    points.push({
      label: `Day ${day}`,
      offset: day,
      maintainabilityIndex: Number(mi.toFixed(1)),
      confidenceLow: Number(Math.max(0, mi - ciWidth).toFixed(1)),
      confidenceHigh: Number(Math.min(100, mi + ciWidth).toFixed(1)),
      isForecast: day > 0,
      debtHours: Math.round((100 - mi) * 3.8),
    });
  }
  return points;
}

export function build3MonthHorizonSeries(baseMi: number, simulatedRefactoring = false): TimelineDataPoint[] {
  const points: TimelineDataPoint[] = [];
  const effectiveMi = simulatedRefactoring ? Math.min(95, baseMi + 8.5) : baseMi;
  const monthlySlope = simulatedRefactoring ? -1.0 : -3.2;

  const offsets = [-3, -2, -1, 0, 1, 2, 3];
  for (const off of offsets) {
    const mi = Math.max(15, Math.min(100, effectiveMi + off * monthlySlope));
    const ciWidth = off > 0 ? Math.abs(off) * 3.0 : 1.5;
    const label = off === 0 ? "Current" : off > 0 ? `Month +${off}` : `Month ${off}`;
    points.push({
      label,
      offset: off,
      maintainabilityIndex: Number(mi.toFixed(1)),
      confidenceLow: Number(Math.max(0, mi - ciWidth).toFixed(1)),
      confidenceHigh: Number(Math.min(100, mi + ciWidth).toFixed(1)),
      isForecast: off > 0,
      debtHours: Math.round((100 - mi) * 4.2),
    });
  }
  return points;
}

export const TechnicalDebtChart: React.FC<TechnicalDebtChartProps> = ({
  repositoryId = "repo-core-01",
  repositoryName = "codepulse-core",
  initialMaintainabilityIndex = 72.4,
  initialRating = "C",
  initialTimeline,
  initialHotspots = DEFAULT_HOTSPOTS,
}) => {
  const [viewMode, setViewMode] = useState<"30-day" | "3-month">("30-day");
  const [simulateRefactor, setSimulateRefactor] = useState(false);
  const [expandedHotspot, setExpandedHotspot] = useState<string | null>(
    initialHotspots[0]?.filePath || null
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const timeline = useMemo(() => {
    if (viewMode === "30-day") {
      return build30DayDegradationSeries(initialMaintainabilityIndex, simulateRefactor);
    }
    return build3MonthHorizonSeries(initialMaintainabilityIndex, simulateRefactor);
  }, [viewMode, initialMaintainabilityIndex, simulateRefactor]);

  const currentPoint = timeline.find((p) => p.offset === 0) || timeline[0];
  const lastPoint = timeline[timeline.length - 1];
  const miDelta = Number(
    (lastPoint.maintainabilityIndex - currentPoint.maintainabilityIndex).toFixed(1)
  );

  // SVG Chart Dimensions
  const svgWidth = 620;
  const svgHeight = 220;
  const paddingX = 45;
  const paddingY = 25;
  const innerWidth = svgWidth - paddingX * 2;
  const innerHeight = svgHeight - paddingY * 2;

  const minMI = 20;
  const maxMI = 100;

  const getX = (idx: number) =>
    paddingX + (idx / Math.max(1, timeline.length - 1)) * innerWidth;
  const getY = (val: number) =>
    paddingY + (1 - (val - minMI) / (maxMI - minMI)) * innerHeight;

  // Confidence Band Polygon Path
  const confidencePolygon = useMemo(() => {
    if (timeline.length === 0) return "";
    const topPoints = timeline.map(
      (p, i) => `${getX(i).toFixed(1)},${getY(p.confidenceHigh).toFixed(1)}`
    );
    const bottomPoints = [...timeline]
      .reverse()
      .map(
        (p, i) =>
          `${getX(timeline.length - 1 - i).toFixed(1)},${getY(
            p.confidenceLow
          ).toFixed(1)}`
      );
    return [...topPoints, ...bottomPoints].join(" ");
  }, [timeline]);

  // Main Prediction Line Path
  const mainLinePath = useMemo(() => {
    return timeline
      .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.maintainabilityIndex).toFixed(1)}`)
      .join(" ");
  }, [timeline]);

  const threshold65Y = getY(65);
  const threshold85Y = getY(85);

  const ratingColor =
    initialRating === "A"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : initialRating === "B"
      ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
      : initialRating === "C"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : initialRating === "D"
      ? "text-orange-400 border-orange-500/30 bg-orange-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10";

  return (
    <div
      data-testid="technical-debt-forecast-card"
      className="rounded-2xl border border-border/60 bg-card p-6 shadow-xl backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingDown className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Technical Debt & Maintainability Forecast
            </h2>
            <span
              data-testid="sqale-rating-badge"
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${ratingColor}`}
            >
              Rating {initialRating}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Repository: <span className="font-mono text-foreground font-medium">{repositoryName}</span> •
            Time-series Holt-Winters degradation curve with 95% confidence intervals
          </p>
        </div>

        {/* View Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              data-testid="toggle-30day"
              onClick={() => setViewMode("30-day")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "30-day"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              30-Day Curve
            </button>
            <button
              type="button"
              data-testid="toggle-3month"
              onClick={() => setViewMode("3-month")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "3-month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              3-Month Horizon
            </button>
          </div>

          <button
            type="button"
            data-testid="simulate-refactor-btn"
            onClick={() => setSimulateRefactor((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              simulateRefactor
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {simulateRefactor ? "Refactoring Active (+8.5 MI)" : "Simulate Refactor"}
          </button>
        </div>
      </div>

      {/* KPI Metric Grid */}
      <div className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Current Maintainability</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              data-testid="current-mi-value"
              className="text-2xl font-bold tracking-tight text-foreground font-mono"
            >
              {currentPoint.maintainabilityIndex}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Normalized SEI Index</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Projected Horizon MI</span>
            {miDelta < 0 ? (
              <ArrowDownRight className="h-4 w-4 text-rose-400" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              data-testid="projected-mi-value"
              className="text-2xl font-bold tracking-tight text-foreground font-mono"
            >
              {lastPoint.maintainabilityIndex}
            </span>
            <span
              className={`text-xs font-medium ${
                miDelta < 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {miDelta > 0 ? `+${miDelta}` : miDelta} pts
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {viewMode === "30-day" ? "30-Day Degradation" : "90-Day Degradation"}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Remediation Debt</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              data-testid="remediation-debt-hours"
              className="text-2xl font-bold tracking-tight text-foreground font-mono"
            >
              {lastPoint.debtHours || 116}
            </span>
            <span className="text-xs text-muted-foreground">hours</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Estimated engineering backlog</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Hotspot Files</span>
            <Flame className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              data-testid="hotspot-count-value"
              className="text-2xl font-bold tracking-tight text-foreground font-mono"
            >
              {initialHotspots.length}
            </span>
            <span className="text-xs text-rose-400 font-medium">Critical</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">High churn × bug-fix density</p>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="mt-6 rounded-xl border border-border/50 bg-card/60 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confidence Interval Fan & Degradation Trajectory
          </span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/30" />
              95% Confidence Band
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Forecasted MI
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-0.5 w-3 border-t border-dashed border-rose-400" />
              Critical (MI &lt; 65)
            </span>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          <svg
            data-testid="technical-debt-chart-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none"
          >
            <defs>
              <linearGradient id="confidenceBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Threshold line: Critical (65) */}
            <line
              x1={paddingX}
              y1={threshold65Y}
              x2={svgWidth - paddingX}
              y2={threshold65Y}
              stroke="#f43f5e"
              strokeDasharray="4,4"
              strokeWidth="1.2"
              opacity="0.6"
            />
            <text
              x={svgWidth - paddingX - 4}
              y={threshold65Y - 4}
              fill="#f43f5e"
              fontSize="10"
              textAnchor="end"
              opacity="0.8"
            >
              Critical Threshold (65)
            </text>

            {/* Threshold line: Good (85) */}
            <line
              x1={paddingX}
              y1={threshold85Y}
              x2={svgWidth - paddingX}
              y2={threshold85Y}
              stroke="#10b981"
              strokeDasharray="4,4"
              strokeWidth="1.2"
              opacity="0.4"
            />
            <text
              x={svgWidth - paddingX - 4}
              y={threshold85Y - 4}
              fill="#10b981"
              fontSize="10"
              textAnchor="end"
              opacity="0.7"
            >
              Healthy Threshold (85)
            </text>

            {/* 95% Confidence Band Polygon */}
            {confidencePolygon && (
              <polygon
                points={confidencePolygon}
                fill="url(#confidenceBandGradient)"
              />
            )}

            {/* Main Trend Line */}
            <path
              d={mainLinePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {timeline.map((point, index) => {
              const cx = getX(index);
              const cy = getY(point.maintainabilityIndex);
              const isHovered = hoveredIndex === index;
              return (
                <g
                  key={point.label}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill={point.isForecast ? "#8b5cf6" : "#3b82f6"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  {/* Point labels for first, mid, and last */}
                  {(index === 0 || index === timeline.length - 1 || isHovered) && (
                    <text
                      x={cx}
                      y={cy - 10}
                      fill="currentColor"
                      fontSize="10"
                      textAnchor="middle"
                      className="fill-foreground font-mono font-medium"
                    >
                      {point.maintainabilityIndex}
                    </text>
                  )}
                  {/* X Axis labels */}
                  <text
                    x={cx}
                    y={svgHeight - 6}
                    fill="currentColor"
                    fontSize="9"
                    textAnchor="middle"
                    className="fill-muted-foreground"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Inspector Tooltip */}
        {hoveredIndex !== null && timeline[hoveredIndex] && (
          <div
            data-testid="chart-hover-inspector"
            className="mt-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-foreground"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-semibold">{timeline[hoveredIndex].label}</span>
              <span className="text-muted-foreground">
                ({timeline[hoveredIndex].isForecast ? "Forecast" : "Observed"})
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono">
              <span>
                MI: <strong>{timeline[hoveredIndex].maintainabilityIndex}</strong>
              </span>
              <span className="text-muted-foreground">
                95% CI: [{timeline[hoveredIndex].confidenceLow} - {timeline[hoveredIndex].confidenceHigh}]
              </span>
              <span>
                Debt: <strong>{timeline[hoveredIndex].debtHours} hrs</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top 5 Hotspot Files Section */}
      <div className="mt-8 border-t border-border/40 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              Top 5 Hotspot Files & Refactoring Recommendations
            </h3>
            <p className="text-xs text-muted-foreground">
              Ranked by commit churn velocity, bug-fix density, and cyclomatic complexity
            </p>
          </div>
        </div>

        <div
          data-testid="hotspots-list"
          className="space-y-3"
        >
          {initialHotspots.map((hotspot) => {
            const isExpanded = expandedHotspot === hotspot.filePath;
            const severityColor =
              hotspot.riskSeverity === "CRITICAL"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : hotspot.riskSeverity === "HIGH"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-blue-500/10 text-blue-400 border-blue-500/30";

            return (
              <div
                key={hotspot.filePath}
                data-testid={`hotspot-item-${hotspot.rank}`}
                className="rounded-xl border border-border/60 bg-muted/10 p-4 transition-all hover:border-primary/40"
              >
                <div
                  className="flex cursor-pointer items-center justify-between gap-3"
                  onClick={() =>
                    setExpandedHotspot(isExpanded ? null : hotspot.filePath)
                  }
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-mono font-bold text-foreground">
                      #{hotspot.rank}
                    </span>
                    <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-sm font-semibold text-foreground">
                      {hotspot.filePath}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex rounded-md border border-border/60 bg-card px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      LOC {hotspot.loc}
                    </span>
                    <span className="hidden sm:inline-flex rounded-md border border-border/60 bg-card px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      CC {hotspot.cyclomaticComplexity}
                    </span>
                    <span className="rounded-md border border-border/60 bg-card px-2 py-0.5 text-xs font-mono text-foreground font-medium">
                      MI {hotspot.maintainabilityIndex}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityColor}`}
                    >
                      {hotspot.riskSeverity}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Details and Refactoring Advice */}
                {isExpanded && (
                  <div
                    data-testid={`hotspot-details-${hotspot.rank}`}
                    className="mt-4 border-t border-border/40 pt-3"
                  >
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 font-mono text-muted-foreground mb-3">
                      <div>
                        Churn: <strong className="text-foreground">{hotspot.churnVelocity} lines/day</strong>
                      </div>
                      <div>
                        Bug-Fix Ratio: <strong className="text-foreground">{(hotspot.bugFixRatio * 100).toFixed(0)}%</strong>
                      </div>
                      <div>
                        Halstead Difficulty: <strong className="text-foreground">{hotspot.halsteadDifficulty}</strong>
                      </div>
                      <div>
                        Hotspot Score: <strong className="text-rose-400">{hotspot.hotspotScore}</strong>
                      </div>
                    </div>

                    <div className="rounded-lg bg-card border border-border/50 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                        <Wrench className="h-3.5 w-3.5" />
                        Actionable Refactoring Recommendations:
                      </div>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {hotspot.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

