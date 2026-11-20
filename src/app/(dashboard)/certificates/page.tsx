'use client';

import React, { useState } from 'react';
import { Award, Download, CheckCircle2, ShieldCheck, QrCode, ExternalLink } from 'lucide-react';

export default function CertificatesPage() {
  const [selectedCert] = useState({
    id: 'CP-CERT-NSOC26-9F82A',
    recipientName: 'Alex Mercer',
    recipientUsername: 'alexmercer',
    achievementTitle: 'NSoC 2026 Core Contributor - Distinction',
    category: 'NSOC_COMPLETION',
    issuedAt: '2026-05-15T00:00:00.000Z',
    sha256Fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    issuer: 'Nexus Spring of Code (NSoC) & CodePulse',
  });

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Award className="h-8 w-8 text-amber-400" />
            Milestone Certificates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verifiable, tamper-proof proof of engineering excellence backed by cryptographic SHA-256 signatures.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition shadow"
        >
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      {/* Certificate Frame Preview */}
      <div className="relative rounded-2xl border-4 border-amber-500/30 bg-gradient-to-br from-card via-card/90 to-background p-10 md:p-14 shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold uppercase tracking-widest">
            <ShieldCheck className="h-3.5 w-3.5" /> Official NSoC Credential
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              This Certificate is Proudly Awarded To
            </h2>
            <div className="text-3xl md:text-5xl font-black text-foreground tracking-tight font-serif">
              {selectedCert.recipientName}
            </div>
            <p className="text-sm font-mono text-primary font-medium">@{selectedCert.recipientUsername}</p>
          </div>

          <div className="max-w-xl mx-auto py-4 border-y border-border/60">
            <p className="text-sm text-muted-foreground leading-relaxed">
              In recognition of extraordinary performance, architectural leadership, and successful contribution during the
            </p>
            <div className="text-lg md:text-xl font-bold text-amber-300 mt-1">
              {selectedCert.achievementTitle}
            </div>
          </div>

          {/* Verification Badge & Cryptographic Proof */}
          <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-left border-t border-border/40">
            <div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase">Issuer</div>
              <div className="text-xs font-semibold text-foreground">{selectedCert.issuer}</div>
              <div className="text-[11px] font-mono text-muted-foreground mt-1">
                Issued: {new Date(selectedCert.issuedAt).toLocaleDateString()}
              </div>
            </div>

            <div className="text-center">
              <div className="inline-block p-2 rounded-xl bg-background/80 border border-border shadow-sm">
                <QrCode className="h-12 w-12 text-primary mx-auto" />
                <div className="text-[9px] font-mono text-muted-foreground mt-1">Scan to Verify</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[11px] font-mono text-muted-foreground uppercase">Certificate ID</div>
              <div className="text-xs font-mono font-bold text-foreground">{selectedCert.id}</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate mt-1 max-w-[200px] ml-auto">
                SHA: {selectedCert.sha256Fingerprint.substring(0, 16)}...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
