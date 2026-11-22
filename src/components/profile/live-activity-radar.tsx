"use client";

import { useState, useEffect, useRef } from "react";
import { GitCommit, GitPullRequest, Star, Radio, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface RadarBlip {
  angle: number; // in radians
  distance: number; // 0 to 1
  label: string;
  type: "commit" | "pr" | "star";
  color: string;
}

interface LiveActivityRadarProps {
  username: string;
  className?: string;
}

const DEFAULT_BLIPS: RadarBlip[] = [
  { angle: 0.6, distance: 0.75, label: "Live Push", type: "commit", color: "#22d3ee" },
  { angle: 2.1, distance: 0.55, label: "PR #204", type: "pr", color: "#c084fc" },
  { angle: 4.2, distance: 0.85, label: "Star Received", type: "star", color: "#fbbf24" },
  { angle: 5.3, distance: 0.4, label: "Commit Push", type: "commit", color: "#34d399" },
];

export function LiveActivityRadar({ username, className }: LiveActivityRadarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 280, height: 280 });

  const [events, setEvents] = useState([
    {
      id: "ev-1",
      type: "LIVE_PUSH",
      text: `Pushed 2 commits to ${username || "developer"}/CodePulse`,
      time: "Just now",
      icon: <GitCommit className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: "ev-2",
      type: "PR_OPENED",
      text: "Opened Pull Request #204 in react-nexus",
      time: "2m ago",
      icon: <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />,
    },
    {
      id: "ev-3",
      type: "STAR_RECEIVED",
      text: "Received a new star on dev-arsenal",
      time: "12m ago",
      icon: <Star className="w-3.5 h-3.5 text-amber-400" />,
    },
  ]);

  // Prevent squishing by observing container width and setting strict 1:1 aspect ratio
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const side = Math.max(160, Math.min(rect.width, 360));
      setDimensions({ width: side, height: side });
    };

    updateSize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", updateSize);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Radar Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let sweepAngle = 0;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    const render = () => {
      const size = dimensions.width;
      const center = size / 2;
      const radius = size * 0.44;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      // 1. Radar background circle
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 16, 29, 0.7)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
      ctx.stroke();

      // 2. Concentric Range Rings
      const rings = [0.25, 0.5, 0.75, 1];
      rings.forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(center, center, radius * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 3. Crosshairs
      ctx.beginPath();
      ctx.moveTo(center - radius, center);
      ctx.lineTo(center + radius, center);
      ctx.moveTo(center, center - radius);
      ctx.lineTo(center, center + radius);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.stroke();

      // 4. Rotating Sweep Beam
      sweepAngle = (sweepAngle + 0.025) % (Math.PI * 2);
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(sweepAngle);

      const sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      sweepGradient.addColorStop(0, "rgba(34, 211, 238, 0.35)");
      sweepGradient.addColorStop(1, "rgba(34, 211, 238, 0.0)");

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -0.4, 0);
      ctx.closePath();
      ctx.fillStyle = sweepGradient;
      ctx.fill();

      // Sweep leading edge line
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 5. Blips
      DEFAULT_BLIPS.forEach((blip) => {
        const bx = center + Math.cos(blip.angle) * (radius * blip.distance);
        const by = center + Math.sin(blip.angle) * (radius * blip.distance);

        // Blip outer pulse ring
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fillStyle = blip.color + "33";
        ctx.fill();

        // Blip core dot
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = blip.color;
        ctx.shadowColor = blip.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();
      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [dimensions]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-xl space-y-5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Live Activity Radar
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
          <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span>Sweep 360°</span>
        </div>
      </div>

      {/* Radar Canvas Container with aspect-ratio lock to prevent squishing on resize */}
      <div
        ref={containerRef}
        data-testid="radar-chart-container"
        className="w-full flex justify-center items-center py-2 overflow-hidden"
      >
        <div
          className="relative aspect-square flex items-center justify-center"
          style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        >
          <canvas
            ref={canvasRef}
            data-testid="radar-canvas"
            style={{
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              display: "block",
            }}
            className="rounded-full shadow-inner"
          />
        </div>
      </div>

      {/* Events Feed */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Detected Signals
        </div>
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                {ev.icon}
              </div>
              <span className="font-medium text-slate-200 truncate">{ev.text}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-3">{ev.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
