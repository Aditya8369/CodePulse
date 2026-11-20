'use client';

import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, X } from 'lucide-react';

interface BadgeEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export const BadgeEmbedModal: React.FC<BadgeEmbedModalProps> = ({
  isOpen,
  onClose,
  username = 'developer',
}) => {
  const [theme, setTheme] = useState<'dark' | 'cyberpunk' | 'light'>('dark');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const badgeUrl = `https://codepulse.dev/api/badge/${username}?theme=${theme}`;
  const markdownSnippet = `[![CodePulse Stats](${badgeUrl})](https://codepulse.dev/u/${username})`;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground text-base">GitHub README Badge Embed</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Badge Preview */}
        <div className="p-4 rounded-xl bg-background/50 border border-border flex flex-col items-center justify-center">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Live Preview
          </div>
          <img
            src={`/api/badge/${username}?theme=${theme}`}
            alt="CodePulse Developer Badge"
            className="rounded-lg shadow max-w-full"
            onError={e => {
              // fallback if local dev
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Theme Picker */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Badge Theme:</span>
          <div className="flex items-center gap-2">
            {(['dark', 'cyberpunk', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  theme === t
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Markdown Snippet */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground">Markdown Snippet:</span>
          <div className="relative">
            <pre className="p-3 rounded-lg border border-border bg-slate-950 text-xs font-mono text-slate-300 overflow-x-auto">
              {markdownSnippet}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 p-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1 shadow"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
