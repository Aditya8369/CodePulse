"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Coins,
  ShieldAlert,
  X,
  Zap,
  TrendingUp,
  Percent,
  Sparkles,
  Calculator,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface WagerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponentUsername: string;
  userAvailableXp?: number;
  oddsMultiplier?: number;
  minWager?: number;
  maxWager?: number;
  onConfirmWager: (amount: number, potentialPayout?: number) => void;
}

export const WagerSetupModal: React.FC<WagerSetupModalProps> = ({
  isOpen,
  onClose,
  opponentUsername,
  userAvailableXp = 500,
  oddsMultiplier = 1.95,
  minWager = 25,
  maxWager,
  onConfirmWager,
}) => {
  const actualMaxWager = useMemo(() => {
    return maxWager !== undefined
      ? maxWager
      : Math.max(userAvailableXp, minWager);
  }, [maxWager, userAvailableXp, minWager]);

  const [selectedAmount, setSelectedAmount] = useState<number>(() => {
    return Math.min(100, actualMaxWager);
  });

  // Keep selected amount in valid range when userAvailableXp or minWager changes
  useEffect(() => {
    if (selectedAmount > actualMaxWager && actualMaxWager >= minWager) {
      setSelectedAmount(actualMaxWager);
    } else if (selectedAmount < minWager) {
      setSelectedAmount(minWager);
    }
  }, [actualMaxWager, minWager, selectedAmount]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Odds & Payout Calculations
  const calculations = useMemo(() => {
    const odds = Math.max(1.05, oddsMultiplier);
    const potentialPayout = Math.floor(selectedAmount * odds);
    const netProfit = Math.max(0, potentialPayout - selectedAmount);
    const impliedProbability = Math.min(100, Math.round((1 / odds) * 100));

    return {
      odds,
      potentialPayout,
      netProfit,
      impliedProbability,
    };
  }, [selectedAmount, oddsMultiplier]);

  const isInsufficient = selectedAmount > userAvailableXp;
  const isBelowMin = selectedAmount < minWager;
  const isInvalid = isInsufficient || isBelowMin || userAvailableXp < minWager;

  const handlePercentageSelect = useCallback(
    (percent: number) => {
      if (userAvailableXp <= 0) return;
      const targetAmount =
        percent === 100
          ? Math.min(userAvailableXp, actualMaxWager)
          : Math.max(
              minWager,
              Math.floor((userAvailableXp * (percent / 100)) / 5) * 5,
            );
      setSelectedAmount(Math.min(targetAmount, actualMaxWager));
    },
    [userAvailableXp, actualMaxWager, minWager],
  );

  const handleConfirm = useCallback(() => {
    if (isInvalid) {
      if (isInsufficient) {
        toast.error("Insufficient PulseBits XP balance to place this wager.");
      } else if (isBelowMin) {
        toast.error(`Minimum wager amount is ${minWager} XP.`);
      }
      return;
    }

    try {
      onConfirmWager(selectedAmount, calculations.potentialPayout);
      toast.success(
        `Wager of ${selectedAmount} PulseBits XP placed against @${opponentUsername}!`,
      );
      onClose();
    } catch {
      toast.error("Failed to place wager. Please try again.");
    }
  }, [
    isInvalid,
    isInsufficient,
    isBelowMin,
    minWager,
    onConfirmWager,
    selectedAmount,
    calculations.potentialPayout,
    opponentUsername,
    onClose,
  ]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wager-modal-title"
          aria-describedby="wager-modal-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-card p-6 md:p-8 shadow-2xl space-y-6 text-foreground relative overflow-hidden"
          >
            {/* Header Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3
                    id="wager-modal-title"
                    className="font-bold text-foreground text-lg flex items-center gap-2"
                  >
                    PulseBits Staking & Odds
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Prediction market escrow against{" "}
                    <span className="font-semibold text-foreground">
                      @{opponentUsername}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Balance Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                Your Stash Balance:
              </span>
              <span
                data-testid="user-available-xp"
                className="font-mono font-bold text-emerald-400 text-sm"
              >
                {userAvailableXp.toLocaleString()} XP
              </span>
            </div>

            {/* Interactive PulseBits Slider Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="wager-slider"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Stake Amount (XP)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    id="wager-amount-input"
                    data-testid="wager-amount-input"
                    min={minWager}
                    max={actualMaxWager}
                    value={selectedAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSelectedAmount(isNaN(val) ? minWager : val);
                    }}
                    className="w-24 text-right font-mono font-bold text-sm bg-muted/40 border border-border rounded-lg px-2 py-1 outline-none focus:border-primary text-foreground"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    XP
                  </span>
                </div>
              </div>

              {/* Range Slider */}
              <div className="relative pt-1 pb-1">
                <input
                  type="range"
                  id="wager-slider"
                  data-testid="wager-range-slider"
                  min={minWager}
                  max={actualMaxWager}
                  step={5}
                  value={selectedAmount}
                  onChange={(e) => setSelectedAmount(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
                  <span>Min: {minWager} XP</span>
                  <span>Max: {actualMaxWager} XP</span>
                </div>
              </div>

              {/* Quick Percentage Chips */}
              <div className="flex items-center gap-2 pt-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentageSelect(pct)}
                    className="flex-1 py-1.5 text-xs font-semibold font-mono rounded-lg border border-border/80 bg-background/50 hover:bg-muted text-foreground transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {pct === 100 ? "MAX" : `${pct}%`}
                  </button>
                ))}
              </div>

              {isInsufficient && (
                <p
                  data-testid="insufficient-xp-warning"
                  className="text-xs text-rose-400 flex items-center gap-1 font-medium"
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  Amount exceeds your current available XP balance.
                </p>
              )}
            </div>

            {/* Prediction Market Odds & Payout Calculator Card */}
            <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground border-b border-border/40 pb-2">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Prediction Market Odds Calculator
                </span>
                <span
                  data-testid="odds-multiplier-badge"
                  className="font-mono text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold"
                >
                  {calculations.odds.toFixed(2)}x Odds
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-background/60 border border-border/50">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Potential Payout
                  </div>
                  <div
                    data-testid="potential-payout"
                    className="text-lg font-mono font-black text-emerald-400 mt-1"
                  >
                    {calculations.potentialPayout.toLocaleString()} XP
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background/60 border border-border/50">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                    Net Profit
                  </div>
                  <div
                    data-testid="net-profit"
                    className="text-lg font-mono font-black text-amber-400 mt-1"
                  >
                    +{calculations.netProfit.toLocaleString()} XP
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
                <span>Implied Win Probability:</span>
                <span
                  data-testid="implied-win-probability"
                  className="font-mono font-bold text-foreground"
                >
                  ~{calculations.impliedProbability}%
                </span>
              </div>
            </div>

            {/* Escrow Disclaimer Notice */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                XP is held safely in escrow. If the challenge ends in a draw or
                is cancelled before starting, staked PulseBits are fully
                refunded.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-wager-button"
                disabled={isInvalid}
                onClick={handleConfirm}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5",
                  isInvalid
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20 cursor-pointer",
                )}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                Stake {selectedAmount} XP
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WagerSetupModal;
