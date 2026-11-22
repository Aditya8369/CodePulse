"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Minus,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { buildStreakMonth, getActivityDays, longestActivityStreak } from "@/lib/streak-calendar";
import { StreakFlameParticles } from "./streak-flame-particles";
import { cn } from "@/lib/utils";

export interface StreakCalendarProps {
  activity: unknown;
  currentStreak: number;
  longestStreak?: number;
  protectedDates?: string[];
  freezeInventory?: number | null;
  today?: Date;
  onEquipFreeze?: (date: string) => void;
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FREEZE_XP_COST = 150;

export function StreakCalendar({
  activity,
  currentStreak,
  longestStreak = 0,
  protectedDates = [],
  freezeInventory = 1,
  today = new Date(),
  onEquipFreeze,
}: StreakCalendarProps) {
  const [month, setMonth] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const [inventory, setInventory] = useState<number>(freezeInventory ?? 1);
  const [localProtected, setLocalProtected] = useState<string[]>(protectedDates);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [selectedCell, setSelectedCell] = useState<{ date: string; status: string; count: number } | null>(null);

  const days = useMemo(() => getActivityDays(activity), [activity]);
  const cells = buildStreakMonth(month.getUTCFullYear(), month.getUTCMonth(), days, localProtected);
  const best = Math.max(longestStreak, longestActivityStreak(days));
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);

  function shiftMonth(offset: number) {
    setMonth((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1)));
  }

  const handlePurchaseFreeze = () => {
    setInventory((prev) => prev + purchaseQty);
    toast.success(`Successfully purchased ${purchaseQty} Streak Freeze${purchaseQty > 1 ? "s" : ""}!`, {
      description: `Deducted ${purchaseQty * FREEZE_XP_COST} XP from your balance.`,
    });
    setIsPurchaseModalOpen(false);
    setPurchaseQty(1);
  };

  const handleApplyFreeze = (targetDate: string) => {
    if (inventory <= 0) {
      setIsPurchaseModalOpen(true);
      toast.error("No Streak Freezes available. Purchase one below!");
      return;
    }
    if (localProtected.includes(targetDate)) {
      toast.info("Date is already streak-protected!");
      return;
    }
    setInventory((prev) => prev - 1);
    setLocalProtected((prev) => [...prev, targetDate]);
    onEquipFreeze?.(targetDate);
    toast.success(`Streak Freeze equipped for ${targetDate}!`, {
      description: "Your streak flame is protected from breaking on this day.",
    });
    setSelectedCell(null);
  };

  return (
    <section className="glass-card rounded-[20px] border border-white/10 p-5 sm:p-6" aria-label="Contribution streak calendar">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Flame className="h-5 w-5 text-orange-400" aria-hidden="true" />
              Contribution streak
            </h2>
            {currentStreak >= 7 && (
              <StreakFlameParticles streak={currentStreak} showBadge={true} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">A day-by-day view of your synced GitHub activity.</p>
        </div>
        <div className="flex items-center gap-2" aria-label="Change calendar month">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-lg border border-white/10 p-2 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-32 text-center text-sm font-semibold" aria-live="polite">{monthLabel}</span>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-lg border border-white/10 p-2 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-orange-400/20 bg-orange-400/5 p-3">
          {currentStreak >= 7 && (
            <div className="absolute inset-0 pointer-events-none">
              <StreakFlameParticles streak={currentStreak} showBadge={false} className="h-full w-full" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">Current streak</p>
          <p className="mt-1 text-xl font-bold text-orange-400 flex items-center gap-1.5">
            <span>{currentStreak} days</span>
            {currentStreak >= 7 && <Flame className="h-4 w-4 fill-orange-400/30 animate-pulse" />}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-muted-foreground">Best streak</p>
          <p className="mt-1 text-xl font-bold">{best} days</p>
        </div>
        <div
          data-testid="streak-freeze-inventory-card"
          className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-muted-foreground">Streak freezes</p>
            <p className="mt-1 text-xl font-bold text-sky-300">
              {inventory} available
            </p>
          </div>
          <button
            type="button"
            data-testid="buy-more-freezes-btn"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-300 transition-colors cursor-pointer"
            title="Purchase Streak Freeze"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Days */}
      <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-xs sm:gap-2">
        {weekdays.map((day) => <div key={day} className="py-1 font-semibold text-muted-foreground">{day}</div>)}
        {cells.map((cell, index) => cell ? (
          <button
            key={cell.date}
            type="button"
            onClick={() => {
              if (cell.status === "active") {
                toast.info(`${cell.date}: ${cell.count} commit contributions`);
              } else {
                setSelectedCell(cell);
              }
            }}
            title={`${cell.date}: ${cell.status === "active" ? `${cell.count} contribution${cell.count === 1 ? "" : "s"}` : cell.status === "protected" ? "streak protected" : "no activity - click to freeze"}`}
            aria-label={`${cell.date}: ${cell.status === "active" ? `${cell.count} contributions` : cell.status === "protected" ? "streak protected" : "no activity"}`}
            className={cn(
              "flex aspect-square min-h-8 flex-col items-center justify-center rounded-lg border text-xs transition-transform hover:scale-105 cursor-pointer",
              cell.status === "active"
                ? "border-orange-400/40 bg-orange-400/15 text-orange-300"
                : cell.status === "protected"
                ? "border-sky-400/40 bg-sky-400/15 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                : "border-white/5 bg-white/[0.03] text-muted-foreground hover:border-sky-400/30"
            )}
          >
            <span>{cell.day}</span>
            {cell.status === "active" ? (
              <Flame className="h-3 w-3" aria-hidden="true" />
            ) : cell.status === "protected" ? (
              <Snowflake className="h-3 w-3" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="mt-1 h-1 w-1 rounded-full bg-current opacity-50" />
            )}
          </button>
        ) : <div key={`empty-${index}`} aria-hidden="true" />)}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs text-muted-foreground">
          Flame: contributions · Snowflake: protected day · Dot: no activity
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="open-streak-freeze-modal-btn"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="rounded-lg border border-sky-400/30 bg-sky-500/10 hover:bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>Equip / Buy Freeze</span>
          </button>
        </div>
      </div>

      {/* Streak Freeze Purchase Modal */}
      <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <DialogContent
          data-testid="streak-freeze-purchase-modal"
          className="max-w-md bg-[#0B0F19]/95 backdrop-blur-2xl border border-sky-500/30 text-white rounded-[28px] p-6 shadow-2xl"
        >
          <DialogHeader className="text-center sm:text-center items-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border-2 border-sky-400/30 flex items-center justify-center text-sky-300 shadow-[0_0_25px_rgba(56,189,248,0.3)] mb-2">
              <Snowflake className="w-8 h-8 animate-spin-slow" />
            </div>
            <DialogTitle className="text-2xl font-black text-white">
              Streak Freeze Protection
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs max-w-xs mt-1">
              Missed a day of coding? Streak Freezes automatically shield your hard-earned streak flame from resetting to 0.
            </DialogDescription>
          </DialogHeader>

          {/* Current Inventory Banner */}
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 flex items-center justify-between my-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              <div>
                <p className="text-xs text-slate-400">Current Inventory</p>
                <p className="text-base font-bold text-white">{inventory} Freeze{inventory === 1 ? "" : "s"}</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-400/20">
              Active Shield
            </span>
          </div>

          {/* Quantity Selector & Cost Calculation */}
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span>Select Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="freeze-qty-minus"
                  disabled={purchaseQty <= 1}
                  onClick={() => setPurchaseQty((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span data-testid="freeze-qty-display" className="w-6 text-center font-bold text-sm">
                  {purchaseQty}
                </span>
                <button
                  type="button"
                  data-testid="freeze-qty-plus"
                  disabled={purchaseQty >= 5}
                  onClick={() => setPurchaseQty((q) => Math.min(5, q + 1))}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
              <span className="text-slate-400">Total Price:</span>
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                {purchaseQty * FREEZE_XP_COST} XP
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-purchase-freeze-btn"
              onClick={handlePurchaseFreeze}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-lg shadow-sky-500/25 active:scale-95 cursor-pointer"
            >
              Confirm Purchase
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selected Day Quick Equip Sheet */}
      {selectedCell && (
        <Dialog open={Boolean(selectedCell)} onOpenChange={() => setSelectedCell(null)}>
          <DialogContent className="max-w-sm bg-[#0B0F19]/95 backdrop-blur-2xl border border-white/10 text-white rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-sky-400" />
                Protect {selectedCell.date}?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                Equip 1 Streak Freeze to cover this date and keep your overall streak active.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs my-2">
              <span className="text-slate-300">Remaining Inventory:</span>
              <span className="font-bold text-sky-300">{inventory} Freezes</span>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5"
              >
                Close
              </button>
              <button
                type="button"
                data-testid="confirm-equip-freeze-cell-btn"
                onClick={() => handleApplyFreeze(selectedCell.date)}
                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all"
              >
                Apply Freeze
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
