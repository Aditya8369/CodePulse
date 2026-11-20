"use client";

import { motion } from "motion/react";
import { Swords, Trophy, Users, Flame, Shield, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuildBattleCardProps {
  battle: {
    id: string;
    guild1: { name: string; tag: string; score: number; members: number; banner?: string };
    guild2: { name: string; tag: string; score: number; members: number; banner?: string };
    endsIn: string;
    category: string;
  };
}

export function GuildBattleCard({ battle }: GuildBattleCardProps) {
  const total = battle.guild1.score + battle.guild2.score;
  const pct1 = Math.round((battle.guild1.score / (total || 1)) * 100);
  const pct2 = 100 - pct1;

  return (
    <div className="relative rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          <span className="text-xs uppercase font-bold tracking-widest text-slate-300">
            {battle.category} Tournament
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Flame className="w-3.5 h-3.5" />
          <span>Ends in {battle.endsIn}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative">
        {/* Guild 1 */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-lg">
              {battle.guild1.tag}
            </div>
            <div>
              <h4 className="text-xl font-bold text-white leading-tight">{battle.guild1.name}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Users className="w-3.5 h-3.5" /> {battle.guild1.members} Active Contributors
              </p>
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-400">
            {battle.guild1.score.toLocaleString()} <span className="text-sm font-semibold text-slate-400">PTS</span>
          </div>
        </div>

        {/* Guild 2 */}
        <div className="flex flex-col md:items-end space-y-3 text-left md:text-right">
          <div className="flex items-center gap-3 md:flex-row-reverse">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-lg">
              {battle.guild2.tag}
            </div>
            <div>
              <h4 className="text-xl font-bold text-white leading-tight">{battle.guild2.name}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 md:justify-end">
                <Users className="w-3.5 h-3.5" /> {battle.guild2.members} Active Contributors
              </p>
            </div>
          </div>
          <div className="text-3xl font-black text-purple-400">
            {battle.guild2.score.toLocaleString()} <span className="text-sm font-semibold text-slate-400">PTS</span>
          </div>
        </div>
      </div>

      {/* Progress Bar Showdown */}
      <div className="mt-8 space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-400">
          <span className="text-cyan-400">{pct1}% Velocity Share</span>
          <span className="text-purple-400">{pct2}% Velocity Share</span>
        </div>
        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
          <div style={{ width: `${pct1}%` }} className="bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" />
          <div style={{ width: `${pct2}%` }} className="bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500" />
        </div>
      </div>
    </div>
  );
}
