"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gift,
  Sparkles,
  Crown,
  Trophy,
  CheckCircle2,
  PackageOpen,
  Volume2,
  Zap,
  Star,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface UnboxingReward {
  tier: number;
  track: "FREE" | "ELITE";
  label: string;
  category: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "MYTHIC";
  xpBonus?: number;
}

interface RewardUnboxingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reward: UnboxingReward | null;
  onEquip?: (reward: UnboxingReward) => void;
}

const RARITY_THEMES = {
  COMMON: {
    border: "border-slate-500/40",
    gradient: "from-slate-800 to-slate-900",
    glow: "rgba(148, 163, 184, 0.25)",
    text: "text-slate-300",
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  RARE: {
    border: "border-cyan-500/40",
    gradient: "from-cyan-950 via-slate-900 to-blue-950",
    glow: "rgba(6, 182, 212, 0.35)",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  EPIC: {
    border: "border-purple-500/40",
    gradient: "from-purple-950 via-slate-900 to-indigo-950",
    glow: "rgba(168, 85, 247, 0.45)",
    text: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  MYTHIC: {
    border: "border-amber-500/50",
    gradient: "from-amber-950 via-yellow-950 to-orange-950",
    glow: "rgba(245, 158, 11, 0.55)",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
};

function triggerUnboxingBurst() {
  if (typeof window === "undefined") return;
  try {
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#38bdf8", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899"],
      zIndex: 99999,
      disableForReducedMotion: true,
    });
  } catch {
    // Fallback if canvas is unavailable
  }
}

export function RewardUnboxingModal({
  isOpen,
  onClose,
  reward,
  onEquip,
}: RewardUnboxingModalProps) {
  const [isOpened, setIsOpened] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [equipped, setEquipped] = useState(false);

  // Reset state when a new reward is presented
  useEffect(() => {
    if (isOpen) {
      setIsOpened(false);
      setIsShaking(false);
      setEquipped(false);
    }
  }, [isOpen, reward]);

  if (!reward) return null;

  const rarity = reward.rarity || "RARE";
  const theme = RARITY_THEMES[rarity] || RARITY_THEMES.RARE;

  const handleOpenCrate = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setIsOpened(true);
      triggerUnboxingBurst();
      toast.success(`Unboxed ${reward.label}!`, {
        description: `${reward.rarity} ${reward.category} added to your platform wardrobe.`,
      });
    }, 600);
  };

  const handleEquipNow = () => {
    setEquipped(true);
    onEquip?.(reward);
    toast.success(`${reward.label} equipped successfully!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="reward-unboxing-modal"
        className="max-w-md bg-[#0B0F19]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[32px] p-0 overflow-hidden shadow-2xl"
      >
        {/* Top Decorative Banner */}
        <div
          className={cn(
            "h-24 w-full relative bg-gradient-to-b overflow-hidden flex items-center justify-between px-6",
            theme.gradient
          )}
        >
          <div className="flex items-center gap-2 z-10">
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm",
                theme.badge
              )}
            >
              {reward.track} Pass • Tier {reward.tier}
            </span>
          </div>

          <span
            data-testid="unboxing-rarity-badge"
            className={cn(
              "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm z-10 flex items-center gap-1",
              theme.badge
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {reward.rarity}
          </span>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-8 -mt-10 relative z-10 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            {!isOpened ? (
              /* Phase 1: Sealed Mystery Crate */
              <motion.div
                key="sealed-box"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: isShaking ? [-3, 3, -4, 4, 0] : 0,
                }}
                exit={{ opacity: 0, scale: 1.2 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center space-y-4 pt-2"
              >
                {/* 3D-styled Mystery Crate Container */}
                <div
                  data-testid="sealed-mystery-crate"
                  className={cn(
                    "w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 flex items-center justify-center relative cursor-pointer group shadow-2xl transition-all duration-300 hover:scale-105",
                    theme.border,
                    "bg-gradient-to-br from-white/10 via-white/5 to-transparent"
                  )}
                  style={{
                    boxShadow: `0 0 35px ${theme.glow}`,
                  }}
                  onClick={handleOpenCrate}
                >
                  <div className="absolute inset-0 bg-radial from-white/20 to-transparent rounded-3xl pointer-events-none" />
                  <Gift className={cn("w-14 h-14 transition-transform group-hover:scale-110", theme.text)} />
                </div>

                <DialogHeader className="text-center sm:text-center items-center">
                  <DialogTitle className="text-xl font-black text-white">
                    Seasonal Mystery Crate
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 max-w-xs mt-1">
                    Tap the crate to unlock your Tier {reward.tier} seasonal reward!
                  </DialogDescription>
                </DialogHeader>

                <button
                  type="button"
                  data-testid="open-mystery-crate-btn"
                  onClick={handleOpenCrate}
                  disabled={isShaking}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/25 active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <PackageOpen className="w-4 h-4" />
                  <span>{isShaking ? "Unlocking Crate..." : "Open Mystery Crate"}</span>
                </button>
              </motion.div>
            ) : (
              /* Phase 2: Unveiled Reward Reveal */
              <motion.div
                key="unveiled-reward"
                initial={{ opacity: 0, scale: 0.7, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex flex-col items-center space-y-4 pt-2 w-full"
              >
                {/* High Resolution Reward Art */}
                <div
                  data-testid="unboxed-reward-card"
                  className={cn(
                    "w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 flex items-center justify-center relative shadow-2xl",
                    theme.border,
                    "bg-gradient-to-br from-white/10 via-white/5 to-transparent"
                  )}
                  style={{
                    boxShadow: `0 0 45px ${theme.glow}`,
                  }}
                >
                  <Trophy className={cn("w-14 h-14 drop-shadow-lg", theme.text)} />
                </div>

                <DialogHeader className="text-center sm:text-center items-center w-full">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                    {reward.category}
                  </span>
                  <DialogTitle className="text-2xl font-black text-white tracking-tight mt-0.5">
                    {reward.label}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300 max-w-sm mt-1">
                    Unlocked at Battle Pass Tier {reward.tier}. Ready to equip across CodePulse.
                  </DialogDescription>
                </DialogHeader>

                {/* XP Reward Bonus Chip */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
                  <Zap className="w-3.5 h-3.5 fill-amber-400" />
                  <span>+250 Battle Pass XP Granted</span>
                </div>

                {/* Action Buttons: Equip & Collect */}
                <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Collect to Inventory
                  </button>

                  <button
                    type="button"
                    data-testid="equip-unboxed-reward-btn"
                    onClick={handleEquipNow}
                    disabled={equipped}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {equipped ? (
                      <>
                        <Check className="w-4 h-4" /> Equipped!
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Equip Now
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
