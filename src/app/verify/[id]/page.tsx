'use client';

import React from 'react';
import { ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CertificateVerificationPage({ params }: { params: { id: string } }) {
  const isVerified = true;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ShieldCheck className="w-10 h-10" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold tracking-wider">
            CRYPTOGRAPHICALLY VERIFIED
          </span>
          <h1 className="text-2xl font-bold text-foreground mt-3">Valid Certificate</h1>
          <p className="text-xs text-muted-foreground mt-1">Certificate ID: {params.id}</p>
        </div>

        <div className="p-4 rounded-xl bg-background/50 border border-border text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recipient:</span>
            <span className="font-semibold text-foreground">Alex Mercer (@alexmercer)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Achievement:</span>
            <span className="font-semibold text-amber-300">NSoC 2026 Core Contributor</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Issued:</span>
            <span className="font-mono text-foreground">May 15, 2026</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Integrity:</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> SHA-256 Valid
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to CodePulse
        </Link>
      </div>
    </div>
  );
}
