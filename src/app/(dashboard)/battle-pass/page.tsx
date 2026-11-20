"use client";

import React, { useState } from "react";
import {
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Trophy,
  Flame,
  Gift,
  Eye,
  X,
} from "lucide-react";

export type PassTrack = "FREE" | "ELITE";

export interface RoadmapTierItem {
  tier: number;
  requiredXp: number;
  freeReward: {
    code: string;
    category: string;
    label: string;
    rarity: "COMMON" | "RARE" | "EPIC";
  };
  eliteReward: {
    code: string;
    category: string;
    label: string;
    rarity: "RARE" | "EPIC" | "MYTHIC";
  };
}

export interface WeeklyQuestItem {
  id: string;
  title: string;
  xp: number;
  progress: number;
  target: number;
}

function buildRoadmapTiers(): RoadmapTierItem[] {
  return Array.from({ length: 50 }, (_, idx) => {
    const tier = idx + 1;
    const n = tier - 1;
    const requiredXp =
      tier === 1 ? 0 : Math.round(n * 500 + 12.5 * n * (n - 1));
    const isMilestone = tier % 10 === 0;
    return {
      tier,
      requiredXp,
      freeReward: {
        code: `s1_free_t${tier}`,
        category: tier % 2 === 0 ? "Avatar Frame" : "Monaco Theme",
        label: isMilestone
          ? `Genesis Circuit Frame Mk.${tier / 10}`
          : `Syntax Pulse Theme v${tier}`,
        rarity: isMilestone ? "EPIC" : tier >= 25 ? "RARE" : "COMMON",
      },
      eliteReward: {
        code: `s1_elite_t${tier}`,
        category:
          tier % 3 === 0
            ? "SFX Sound Pack"
            : tier % 2 === 0
              ? "Profile Banner"
              : "Monaco Theme",
        label:
          tier === 50
            ? "Mythic Sovereign Compiler Banner & Synth"
            : isMilestone
              ? `Overclocked Holo-Banner Tier ${tier}`
              : `Cyber-Neon Editor Theme #${tier}`,
        rarity: tier === 50 ? "MYTHIC" : isMilestone ? "EPIC" : "RARE",
      },
    };
  });
}

const ROADMAP_TIERS = buildRoadmapTiers();

export default function BattlePassPage() {
  const [totalXp, setTotalXp] = useState<number>(1650);
  const [isElite, setIsElite] = useState<boolean>(true);
  const [claimedFree, setClaimedFree] = useState<number[]>([1]);
  const [claimedElite, setClaimedElite] = useState<number[]>([1]);
  const [inventory, setInventory] = useState<string[]>([
    "Syntax Pulse Theme v1",
    "Cyber-Neon Editor Theme #1",
  ]);
  const [previewModal, setPreviewModal] = useState<{
    tier: number;
    track: PassTrack;
    label: string;
    category: string;
    rarity: string;
  } | null>(null);

  const [quests, setQuests] = useState<WeeklyQuestItem[]>([
    {
      id: "q-daily",
      title: "Complete Daily Coding Challenge (+750 XP)",
      xp: 750,
      progress: 2,
      target: 3,
    },
    {
      id: "q-battle",
      title: "Win a Ranked Coding Battle (+1,000 XP)",
      xp: 1000,
      progress: 4,
      target: 5,
    },
    {
      id: "q-nsoc",
      title: "Merge NSoC'26 Pull Request (+1,500 XP)",
      xp: 1500,
      progress: 1,
      target: 2,
    },
  ]);

  const currentTier = ROADMAP_TIERS.reduce(
    (acc, item) => (totalXp >= item.requiredXp ? item.tier : acc),
    1
  );
  const nextTierSpec =
    ROADMAP_TIERS.find((t) => t.tier === Math.min(50, currentTier + 1)) ??
    ROADMAP_TIERS[49];

  const handleAdvanceQuest = (questId: string) => {
    setQuests((prev) =>
      prev.map((q) => {
        if (q.id !== questId || q.progress >= q.target) return q;
        const nextProg = q.progress + 1;
        if (nextProg >= q.target) {
          setTotalXp((xp) => xp + q.xp);
        }
        return { ...q, progress: nextProg };
      })
    );
  };

  const handleClaimReward = (tier: number, track: PassTrack, label: string) => {
    if (tier > currentTier) return;
    if (track === "FREE") {
      if (claimedFree.includes(tier)) return;
      setClaimedFree((prev) => [...prev, tier]);
    } else {
      if (!isElite || claimedElite.includes(tier)) return;
      setClaimedElite((prev) => [...prev, tier]);
    }
    setInventory((prev) => (prev.includes(label) ? prev : [...prev, label]));
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-zinc-100">
      {/* Season Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-zinc-950 via-indigo-950/30 to-zinc-950 p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              Season 1 • 50 Tiers
            </span>
            <span
              data-testid="bp-current-tier"
              className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300"
            >
              Tier {currentTier} / 50
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Genesis Compiler Battle Pass
          </h1>
          <p className="text-xs text-zinc-400">
            Earn XP from daily challenges, battle victories, code reviews, and NSoC PR merges.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div
              data-testid="bp-total-xp"
              className="font-mono text-lg font-bold text-cyan-300"
            >
              {totalXp.toLocaleString()} XP
            </div>
            <div className="text-[11px] text-zinc-400">
              Next Tier at {nextTierSpec.requiredXp.toLocaleString()} XP
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsElite((e) => !e)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              isElite
                ? "bg-amber-500 text-zinc-950"
                : "border border-amber-500/50 bg-amber-500/10 text-amber-300"
            }`}
          >
            <Crown className="h-4 w-4" />
            {isElite ? "Elite Track Active" : "Activate Elite Track"}
          </button>
        </div>
      </section>

      {/* Weekly Quests */}
      <section className="grid gap-3 md:grid-cols-3">
        {quests.map((q) => {
          const done = q.progress >= q.target;
          return (
            <div
              key={q.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-300">
                    <Flame className="h-3.5 w-3.5" /> Weekly Quest
                  </span>
                  <span className="font-mono text-zinc-400">
                    {q.progress}/{q.target}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-zinc-200">{q.title}</p>
              </div>
              <button
                type="button"
                disabled={done}
                onClick={() => handleAdvanceQuest(q.id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:bg-emerald-700/40 disabled:text-emerald-300"
              >
                {done ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Quest Completed
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Complete Objective (+1)
                  </>
                )}
              </button>
            </div>
          );
        })}
      </section>

      {/* 50-Tier Roadmap Grid (First 12 visible + full 50-tier catalog) */}
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-400" />
            50-Tier Seasonal Progression Roadmap
          </h2>
          <span
            data-testid="bp-inventory-count"
            className="text-xs font-mono text-emerald-400"
          >
            Unlocked Cosmetics: {inventory.length}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP_TIERS.slice(0, 12).map((item) => {
            const unlocked = currentTier >= item.tier;
            const freeClaimed = claimedFree.includes(item.tier);
            const eliteClaimed = claimedElite.includes(item.tier);

            return (
              <div
                key={item.tier}
                className={`flex flex-col gap-2.5 rounded-xl border p-3.5 ${
                  unlocked
                    ? "border-indigo-500/40 bg-zinc-900/90"
                    : "border-zinc-800/70 bg-zinc-900/40 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Tier {item.tier}</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {item.requiredXp.toLocaleString()} XP
                  </span>
                </div>

                {/* Free Track Slot */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>FREE TRACK • {item.freeReward.category}</span>
                    <button
                      type="button"
                      aria-label={`Preview Tier ${item.tier} Free`}
                      onClick={() =>
                        setPreviewModal({
                          tier: item.tier,
                          track: "FREE",
                          ...item.freeReward,
                        })
                      }
                      className="text-zinc-400 hover:text-white"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1 text-xs font-medium text-zinc-200">
                    {item.freeReward.label}
                  </div>
                  <button
                    type="button"
                    disabled={!unlocked || freeClaimed}
                    onClick={() =>
                      handleClaimReward(
                        item.tier,
                        "FREE",
                        item.freeReward.label
                      )
                    }
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {freeClaimed ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Claimed
                      </>
                    ) : unlocked ? (
                      <>
                        <Gift className="h-3 w-3 text-cyan-400" /> Claim Free
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Locked
                      </>
                    )}
                  </button>
                </div>

                {/* Elite Track Slot */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-2.5">
                  <div className="flex items-center justify-between text-[10px] text-amber-300">
                    <span>ELITE TRACK • {item.eliteReward.category}</span>
                    <button
                      type="button"
                      aria-label={`Preview Tier ${item.tier} Elite`}
                      onClick={() =>
                        setPreviewModal({
                          tier: item.tier,
                          track: "ELITE",
                          ...item.eliteReward,
                        })
                      }
                      className="text-amber-300 hover:text-white"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1 text-xs font-medium text-amber-100">
                    {item.eliteReward.label}
                  </div>
                  <button
                    type="button"
                    disabled={!unlocked || !isElite || eliteClaimed}
                    onClick={() =>
                      handleClaimReward(
                        item.tier,
                        "ELITE",
                        item.eliteReward.label
                      )
                    }
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-60"
                  >
                    {eliteClaimed ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Claimed
                      </>
                    ) : unlocked && isElite ? (
                      <>
                        <Crown className="h-3 w-3 text-amber-300" /> Claim Elite
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Locked
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cosmetic Reward Preview Modal */}
      {previewModal && (
        <div
          role="dialog"
          aria-label="Cosmetic Reward Preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-indigo-500/40 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Tier {previewModal.tier} • {previewModal.track} Reward Preview
              </span>
              <button
                type="button"
                aria-label="Close Preview"
                onClick={() => setPreviewModal(null)}
                className="rounded p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mt-2 text-lg font-bold text-white">
              {previewModal.label}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Category: {previewModal.category} • Rarity: {previewModal.rarity} •
              Permanent Account Cosmetic
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
