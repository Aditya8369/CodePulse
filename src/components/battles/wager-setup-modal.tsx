'use client';

import React, { useState } from 'react';
import { Coins, ShieldAlert, CheckCircle2, X } from 'lucide-react';

interface WagerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  opponentUsername: string;
  userAvailableXp: number;
  onConfirmWager: (amount: number) => void;
}

export const WagerSetupModal: React.FC<WagerSetupModalProps> = ({
  isOpen,
  onClose,
  opponentUsername,
  userAvailableXp = 500,
  onConfirmWager,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const tiers = [50, 100, 250, 500];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-foreground text-base">Challenge Staking Pool</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Wager XP against <strong className="text-foreground">@{opponentUsername}</strong>. The winner takes the full 2x bounty pot upon battle victory.
          </p>
          <div className="text-[11px] font-mono text-emerald-400">
            Available Balance: {userAvailableXp} XP
          </div>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-2 gap-3">
          {tiers.map(amt => {
            const isSelected = selectedAmount === amt;
            const disabled = amt > userAvailableXp;

            return (
              <button
                key={amt}
                disabled={disabled}
                onClick={() => setSelectedAmount(amt)}
                className={`p-3 rounded-xl border text-center transition ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : disabled
                    ? 'border-border/40 opacity-40 cursor-not-allowed text-muted-foreground'
                    : 'border-border bg-background/50 hover:border-border/80 text-foreground'
                }`}
              >
                <div className="text-base font-bold">{amt} XP</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Pot: {amt * 2} XP</div>
              </button>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>XP is locked into escrow. In the event of a tie or forfeit before battle start, XP is refunded.</span>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirmWager(selectedAmount);
              onClose();
            }}
            className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow"
          >
            Confirm & Stake
          </button>
        </div>
      </div>
    </div>
  );
};
