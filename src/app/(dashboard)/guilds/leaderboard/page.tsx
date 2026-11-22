"use client";

import { useState } from "react";
import { Shield, Trophy, Users, Flame, Star, Sparkles, Swords, Search } from "lucide-react";
import { GuildBattleCard } from "@/components/guilds/guild-battle-card";
import { Input } from "@/components/ui/input";
import { BackToTop } from "@/components/ui/back-to-top";

export default function GuildLeaderboardPage() {
  const [search, setSearch] = useState("");

  const sampleMatch = {
    id: "match-1",
    category: "48-Hour Weekend Sprint",
    endsIn: "18h 42m",
    guild1: { name: "OpenSource Avengers", tag: "AVENGER", score: 8420, members: 24 },
    guild2: { name: "Rustaceans Elite", tag: "RUST", score: 7910, members: 22 },
  };

  const clans = [
    { rank: 1, name: "OpenSource Avengers", tag: "AVENGER", totalXp: 18450, level: 8, members: 24, winRate: "86%", score: "Top 1%" },
    { rank: 2, name: "Rustaceans Elite", tag: "RUST", totalXp: 16200, level: 7, members: 22, winRate: "81%", score: "Top 2%" },
    { rank: 3, name: "NextJS Ninjas", tag: "NEXT", totalXp: 14100, level: 6, members: 25, winRate: "78%", score: "Top 5%" },
    { rank: 4, name: "Kernel Hackers", tag: "KERN", totalXp: 12900, level: 5, members: 19, winRate: "72%", score: "Top 8%" },
    { rank: 5, name: "Cyberpunk Devs", tag: "CYBER", totalXp: 10800, level: 4, members: 18, winRate: "65%", score: "Top 12%" },
  ];

  const filteredClans = clans.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400 mb-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>Competitive Clans</span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            Developer Guild Leaderboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Aggregated clan velocity, weekend tournament matchups, and global prestige rankings.
          </p>
        </div>
      </div>

      {/* Live Featured GvG Match Card */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Swords className="w-4 h-4 text-rose-500" />
          <span>Featured Live Matchup</span>
        </h3>
        <GuildBattleCard battle={sampleMatch} />
      </div>

      {/* Clan Leaderboard Table */}
      <div className="p-6 rounded-3xl bg-slate-950/80 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Top Tier Guild Rankings</span>
          </h3>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search clans by name or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/40 border-white/10 text-white text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-white/10 text-xs uppercase font-semibold text-slate-400">
              <tr>
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Clan</th>
                <th className="py-3 px-3">Level</th>
                <th className="py-3 px-3">Total XP</th>
                <th className="py-3 px-3">Members</th>
                <th className="py-3 px-3 text-right">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {filteredClans.map((clan) => (
                <tr key={clan.tag} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-3">
                    <span className="font-mono font-bold text-white">#{clan.rank}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 text-cyan-400 border border-white/10">
                        {clan.tag}
                      </span>
                      <span className="font-bold text-white">{clan.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                      Lvl {clan.level}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold text-cyan-300">
                    {clan.totalXp.toLocaleString()} XP
                  </td>
                  <td className="py-3.5 px-3 text-slate-400">
                    {clan.members} / 25
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                    {clan.winRate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Back to Top Button */}
      <BackToTop className="bottom-20 md:bottom-6" />
    </div>
  );
}
