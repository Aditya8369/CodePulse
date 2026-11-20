'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, PackageCheck } from 'lucide-react';

interface DependencyCardProps {
  report: {
    ecosystem: string;
    totalDependencies: number;
    outdated: number;
    healthScore: number;
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    dependencies: Array<{
      name: string;
      version: string;
      severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      advisoryUrl?: string;
    }>;
  };
}

export const RepoTechStackCard: React.FC<DependencyCardProps> = ({ report }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const totalVulns =
    report.vulnerabilities.critical +
    report.vulnerabilities.high +
    report.vulnerabilities.medium +
    report.vulnerabilities.low;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">Tech Stack & Security Health</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
              Ecosystem: {report.ecosystem} • {report.totalDependencies} Packages
            </p>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-full border text-sm font-bold flex items-center gap-1.5 ${getScoreColor(report.healthScore)}`}>
          {report.healthScore >= 80 ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          <span>{report.healthScore} / 100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
          <div className="text-xs text-muted-foreground">Total Deps</div>
          <div className="text-lg font-bold text-foreground">{report.totalDependencies}</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
          <div className="text-xs text-muted-foreground">Outdated</div>
          <div className="text-lg font-bold text-amber-400">{report.outdated}</div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
          <div className="text-xs text-muted-foreground">Vulnerabilities</div>
          <div className={`text-lg font-bold ${totalVulns > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {totalVulns}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-center">
          <div className="text-xs text-muted-foreground">Critical / High</div>
          <div className="text-lg font-bold text-rose-500">
            {report.vulnerabilities.critical + report.vulnerabilities.high}
          </div>
        </div>
      </div>

      {totalVulns > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            Detected Advisories
          </div>
          <div className="space-y-2">
            {report.dependencies
              .filter(d => d.severity)
              .map((dep, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-rose-500/5 border border-rose-500/20">
                  <div className="font-mono text-foreground">
                    {dep.name} <span className="text-muted-foreground">@{dep.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                      {dep.severity}
                    </span>
                    {dep.advisoryUrl && (
                      <a
                        href={dep.advisoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Details
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
