"use client";

import { Keyboard, X, Compass, Sliders, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  icon: LucideIcon;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Navigation",
    icon: Compass,
    shortcuts: [
      { keys: ["Ctrl / ⌘", "K"], description: "Open Command Palette" },
      { keys: ["G", "then", "D"], description: "Navigate to Dashboard" },
      { keys: ["G", "then", "A"], description: "Navigate to Analytics" },
      { keys: ["G", "then", "L"], description: "Navigate to Leaderboard" },
      { keys: ["G", "then", "B"], description: "Navigate to Battles" },
      { keys: ["G", "then", "C"], description: "Navigate to Challenges" },
      { keys: ["G", "then", "P"], description: "Navigate to Profile" },
      { keys: ["G", "then", "S"], description: "Navigate to Settings" },
    ],
  },
  {
    title: "General & Help",
    icon: Sliders,
    shortcuts: [
      { keys: ["?"], description: "Show this Keyboard Shortcuts Guide" },
      { keys: ["Esc"], description: "Close this guide" },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-2xl sm:max-w-2xl rounded-3xl bg-[#09090b] border border-white/10 shadow-2xl overflow-hidden p-0 gap-0 text-white"
      >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-white">
                    Keyboard Shortcuts
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Available navigation and help commands
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close shortcuts guide"
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
              {SHORTCUT_CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <div key={category.title} className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      <Icon className="w-3.5 h-3.5" />
                      {category.title}
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                      {category.shortcuts.map((sc, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-3 text-sm"
                        >
                          <span className="text-slate-300 font-medium">
                            {sc.description}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {sc.keys.map((k, kIdx) => (
                              <kbd
                                key={kIdx}
                                className="px-2 py-1 rounded-lg border border-white/15 bg-white/[0.05] text-[11px] font-mono font-semibold text-slate-200 shadow-sm"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer tip */}
            <div className="p-4 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs text-muted-foreground">
              <span>Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px]">?</kbd> outside text fields to open this guide</span>
              <span>Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px]">Esc</kbd> to dismiss</span>
            </div>
      </DialogContent>
    </Dialog>
  );
}
