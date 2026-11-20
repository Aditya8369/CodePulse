"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface RadarDeveloper {
  username: string;
  name: string;
  avatar: string;
  score: number;
  frameworks: Record<string, number>;
  stats: { totalCommits: number; totalPRs: number; streak: number };
}

export const RADAR_AXES = [
  "Frontend", "Backend", "DevOps", "Speed", "Reliability", "Consistency",
] as const;

type RadarAxis = (typeof RADAR_AXES)[number];
type SignalMap = Record<RadarAxis, number>;

const STACK_GROUPS: Record<"Frontend" | "Backend" | "DevOps", string[]> = {
  Frontend: ["react", "next", "vue", "angular", "svelte", "tailwind", "html", "css"],
  Backend: ["node", "express", "nest", "django", "fastapi", "flask", "spring", "laravel"],
  DevOps: ["docker", "kubernetes", "aws", "azure", "gcp", "terraform", "github actions", "ci/cd"],
};

function safeNumber(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function stackSignal(frameworks: Record<string, number>, group: keyof typeof STACK_GROUPS): number {
  return Object.entries(frameworks ?? {}).reduce((total, [name, count]) => {
    const key = name.trim().toLowerCase();
    return total + (STACK_GROUPS[group].some((term) => key.includes(term)) ? safeNumber(count) : 0);
  }, 0);
}

export function rawRadarSignals(dev: RadarDeveloper): SignalMap {
  return {
    Frontend: stackSignal(dev.frameworks, "Frontend"),
    Backend: stackSignal(dev.frameworks, "Backend"),
    DevOps: stackSignal(dev.frameworks, "DevOps"),
    Speed: safeNumber(dev.stats?.totalCommits),
    Reliability: safeNumber(dev.stats?.totalPRs),
    Consistency: safeNumber(dev.stats?.streak),
  };
}

export function relativeRadarSignals(first: RadarDeveloper, second: RadarDeveloper): [SignalMap, SignalMap] {
  const a = rawRadarSignals(first);
  const b = rawRadarSignals(second);
  const normalize = (value: number, max: number) => max === 0 ? 0 : Math.round((value / max) * 100);
  return [
    Object.fromEntries(RADAR_AXES.map((axis) => [axis, normalize(a[axis], Math.max(a[axis], b[axis]))])) as SignalMap,
    Object.fromEntries(RADAR_AXES.map((axis) => [axis, normalize(b[axis], Math.max(a[axis], b[axis]))])) as SignalMap,
  ];
}

function polygon(values: SignalMap, radius: number, centerX = 600, centerY = 335): string {
  return RADAR_AXES.map((axis, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    const distance = radius * values[axis] / 100;
    return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`;
  }).join(" ");
}

function gridPolygon(percent: number): string {
  return polygon(Object.fromEntries(RADAR_AXES.map((axis) => [axis, percent])) as SignalMap, 170);
}

function shortName(name: string): string {
  return name.length > 19 ? `${name.slice(0, 18)}…` : name;
}

function download(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export function RadarExportModal({
  isOpen, onClose, first, second,
}: {
  isOpen: boolean;
  onClose: () => void;
  first: RadarDeveloper;
  second: RadarDeveloper;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [firstSignals, secondSignals] = useMemo(() => relativeRadarSignals(first, second), [first, second]);
  const comparisonUrl = () => {
    const url = new URL("/compare", window.location.origin);
    url.searchParams.set("u1", first.username);
    url.searchParams.set("u2", second.username);
    return url.toString();
  };
  const verdict = first.score === second.score
    ? "EVEN MATCH"
    : `${shortName(first.score > second.score ? first.name || first.username : second.name || second.username).toUpperCase()} LEADS`;
  const filename = `codepulse-radar-${first.username}-vs-${second.username}`.replace(/[^a-z0-9.-]/gi, "-");

  async function exportCard(format: "png" | "svg") {
    if (!cardRef.current || busy) return;
    const card = cardRef.current.querySelector("svg");
    if (!card) return;
    setBusy(format);
    setError("");
    try {
      const { toPng, toSvg } = await import("html-to-image");
      const options = {
        width: 1200,
        height: 630,
        pixelRatio: format === "png" ? 2 : 1,
        backgroundColor: "#080f1f",
        imagePlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
      };
      const dataUrl = format === "png"
        ? await toPng(card as unknown as HTMLElement, options)
        : await toSvg(card as unknown as HTMLElement, options);
      download(dataUrl, `${filename}.${format}`);
    } catch {
      setError("Export failed. Please try again after the avatars finish loading.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(comparisonUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access is unavailable. Copy the comparison URL from your address bar.");
    }
  }

  async function share() {
    const url = comparisonUrl();
    const text = `${first.name || first.username} vs ${second.name || second.username} on CodePulse`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "CodePulse skill signals", text, url });
      } catch (cause) {
        if ((cause as DOMException).name !== "AbortError") setError("Sharing is unavailable on this device.");
      }
      return;
    }
    window.open(`https://twitter.com/intent/tweet?${new URLSearchParams({ text: `${text} #CodePulse #NSoC26`, url })}`, "_blank", "noopener,noreferrer");
  }

  function shareOnX() {
    const text = `${first.name || first.username} vs ${second.name || second.username} on CodePulse #CodePulse #NSoC26`;
    window.open(`https://twitter.com/intent/tweet?${new URLSearchParams({ text, url: comparisonUrl() })}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl border-white/15 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>Export skill signal radar</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-300">
          Compare stack activity, commits, PRs, and streaks. Radar values are relative signals, not verified skill or reliability ratings.
        </p>
        <div ref={cardRef} className="overflow-hidden rounded-xl border border-white/15" style={{ aspectRatio: "1200 / 630" }}>
          <svg viewBox="0 0 1200 630" width="1200" height="630" className="block h-auto w-full" style={{ fontFamily: "Arial, sans-serif" }} role="img" aria-label={`Skill signal radar comparing ${first.name || first.username} and ${second.name || second.username}`} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="radar-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#07162b"/><stop offset="0.52" stopColor="#11142d"/><stop offset="1" stopColor="#080f1f"/></linearGradient>
              <linearGradient id="radar-border" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#22d3ee"/><stop offset="1" stopColor="#a78bfa"/></linearGradient>
              <clipPath id="radar-avatar-a"><circle cx="145" cy="285" r="58"/></clipPath>
              <clipPath id="radar-avatar-b"><circle cx="1055" cy="285" r="58"/></clipPath>
            </defs>
            <rect width="1200" height="630" fill="url(#radar-bg)"/>
            <rect x="22" y="22" width="1156" height="586" rx="25" fill="none" stroke="url(#radar-border)" strokeOpacity="0.6" strokeWidth="2"/>
            <text x="64" y="76" fill="#22d3ee" fontSize="21" fontWeight="800" letterSpacing="4">CODEPULSE / SIGNAL RADAR</text>
            <text x="64" y="108" fill="#94a3b8" fontSize="16">Two developers. Six comparable signals.</text>
            <rect x="55" y="165" width="220" height="340" rx="22" fill="#111d33" stroke="#1e3a5f"/>
            <rect x="925" y="165" width="220" height="340" rx="22" fill="#1c1735" stroke="#3b2a65"/>
            <circle cx="145" cy="285" r="60" fill="#0e7490"/>
            <circle cx="1055" cy="285" r="60" fill="#7c3aed"/>
            <text x="145" y="300" textAnchor="middle" fill="white" fontSize="43" fontWeight="700">{first.username.slice(0, 1).toUpperCase()}</text>
            <text x="1055" y="300" textAnchor="middle" fill="white" fontSize="43" fontWeight="700">{second.username.slice(0, 1).toUpperCase()}</text>
            {first.avatar && <image href={first.avatar} x="87" y="227" width="116" height="116" clipPath="url(#radar-avatar-a)" preserveAspectRatio="xMidYMid slice"/>}
            {second.avatar && <image href={second.avatar} x="997" y="227" width="116" height="116" clipPath="url(#radar-avatar-b)" preserveAspectRatio="xMidYMid slice"/>}
            <text x="165" y="388" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="700">{shortName(first.name || first.username)}</text>
            <text x="1035" y="388" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="700">{shortName(second.name || second.username)}</text>
            <text x="165" y="419" textAnchor="middle" fill="#67e8f9" fontSize="15">@{shortName(first.username)}</text>
            <text x="1035" y="419" textAnchor="middle" fill="#c4b5fd" fontSize="15">@{shortName(second.username)}</text>
            <text x="165" y="467" textAnchor="middle" fill="#67e8f9" fontSize="33" fontWeight="800">{safeNumber(first.score).toLocaleString()}</text>
            <text x="1035" y="467" textAnchor="middle" fill="#c4b5fd" fontSize="33" fontWeight="800">{safeNumber(second.score).toLocaleString()}</text>
            <text x="165" y="487" textAnchor="middle" fill="#94a3b8" fontSize="13">CODEPULSE RATING</text>
            <text x="1035" y="487" textAnchor="middle" fill="#94a3b8" fontSize="13">CODEPULSE RATING</text>
            {[25, 50, 75, 100].map((step) => <polygon key={step} points={gridPolygon(step)} fill="none" stroke="#64748b" strokeOpacity="0.35" strokeWidth="1"/>)}
            {RADAR_AXES.map((axis, index) => {
              const angle = -Math.PI / 2 + index * Math.PI / 3;
              const x = 600 + Math.cos(angle) * 170;
              const y = 335 + Math.sin(angle) * 170;
              const labelX = 600 + Math.cos(angle) * 208;
              const labelY = 335 + Math.sin(angle) * 208;
              return <g key={axis}>
                <line x1="600" y1="335" x2={x} y2={y} stroke="#64748b" strokeOpacity="0.45"/>
                <text x={labelX} y={labelY + 5} textAnchor="middle" fill="#cbd5e1" fontSize="16" fontWeight="600">{axis}</text>
              </g>;
            })}
            <polygon points={polygon(firstSignals, 170)} fill="#22d3ee" fillOpacity="0.27" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round"/>
            <polygon points={polygon(secondSignals, 170)} fill="#a78bfa" fillOpacity="0.24" stroke="#a78bfa" strokeWidth="3" strokeLinejoin="round"/>
            <circle cx="600" cy="335" r="4" fill="white"/>
            <text x="600" y="573" textAnchor="middle" fill="#e2e8f0" fontSize="19" fontWeight="800" letterSpacing="2">{verdict}</text>
            <text x="600" y="594" textAnchor="middle" fill="#94a3b8" fontSize="12">Relative stack activity • commits • PRs • streak · codepulse.dev/compare</text>
          </svg>
        </div>
        <table className="sr-only">
          <caption>Relative signal values from zero to 100 for each developer. Frontend, Backend and DevOps use framework counts; Speed uses commits, Reliability uses PR count, and Consistency uses streak days. These are activity proxies, not verified skill ratings.</caption>
          <thead><tr><th scope="col">Signal</th><th scope="col">{first.username}</th><th scope="col">{second.username}</th></tr></thead>
          <tbody>{RADAR_AXES.map((axis) => <tr key={axis}><th scope="row">{axis}</th><td>{firstSignals[axis]}</td><td>{secondSignals[axis]}</td></tr>)}</tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportCard("png")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Download size={16}/>{busy === "png" ? "Exporting…" : "Download PNG (2×)"}</button>
          <button type="button" onClick={() => exportCard("svg")} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold"><Download size={16}/>{busy === "svg" ? "Exporting…" : "Download SVG"}</button>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold">{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy link"}</button>
          <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold"><Share2 size={16}/>Share</button>
          <button type="button" onClick={shareOnX} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold"><ExternalLink size={16}/>Post on X</button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
