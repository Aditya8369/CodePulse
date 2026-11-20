"use client";

import { useState } from "react";
import { Flame, Snowflake, ShieldCheck, Zap, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface StreakFreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakCount: number;
}

export function StreakFreezeModal({ isOpen, onClose, streakCount }: StreakFreezeModalProps) {
  const [freezeCount, setFreezeCount] = useState(2);
  const [purchased, setPurchased] = useState(false);

  const handleBuy = () => {
    setFreezeCount((c) => c + 1);
    setPurchased(true);
    setTimeout(() => setPurchased(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white p-6 sm:p-8 rounded-3xl text-center">
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
            <Snowflake className="w-6 h-6 animate-spin" />
          </div>
          <DialogTitle className="text-xl font-bold">Streak Freeze Inventory</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Protect your active {streakCount}-day commit streak when traveling or taking well-deserved rest.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center gap-2">
            {[...Array(freezeCount)].map((_, i) => (
              <div key={i} className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Snowflake className="w-8 h-8" />
              </div>
            ))}
            {[...Array(Math.max(0, 3 - freezeCount))].map((_, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-600">
                <Snowflake className="w-8 h-8" />
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-400">
            <span className="font-bold text-cyan-400">{freezeCount} of 3</span> Shields Active
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 max-w-xs text-center">
            If you miss a calendar day in your local timezone, 1 freeze will automatically consume to maintain your streak.
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleBuy}
            disabled={freezeCount >= 3}
            className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            {purchased ? <Check className="w-4 h-4 text-emerald-400 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {purchased ? "Purchased!" : "Buy Shield (150 XP)"}
          </Button>

          <Button onClick={onClose} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
