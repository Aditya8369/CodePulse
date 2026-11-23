'use client';

import React, { useState, useMemo } from 'react';
import {
  Users2,
  Compass,
  Filter,
  Search,
  Sparkles,
  Radio,
  Sliders,
  CheckCircle2,
  Layers,
  Code2,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  MentorPairingCard,
  MentorPairingProfile,
} from '@/components/mentorship/mentor-pairing-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const INITIAL_MENTORS: MentorPairingProfile[] = [
  {
    name: 'Elena Rostova',
    username: 'elena_rust',
    role: 'Staff Systems Engineer',
    company: 'VectorDB Labs',
    avatarUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=face',
    similarityScore: 96,
    matchingTech: ['TypeScript', 'Rust', 'Docker', 'PostgreSQL'],
    experienceGap: 5,
    bio: 'Staff Systems Engineer specializing in distributed databases, zero-copy serialization, and async Rust services.',
    isAvailableNow: true,
    rating: 4.98,
    sessionsCompleted: 42,
  },
  {
    name: 'Marcus Vance',
    username: 'marcus_fullstack',
    role: 'Frontend Architect',
    company: 'NextGen UI',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
    similarityScore: 91,
    matchingTech: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
    experienceGap: 4,
    bio: 'Frontend Architect passionate about micro-frontends, accessible component hierarchies, and high-DPI canvas renderers.',
    isAvailableNow: false,
    rating: 4.92,
    sessionsCompleted: 35,
  },
  {
    name: 'Aisha Patel',
    username: 'aisha_cloud',
    role: 'Lead DevOps Engineer',
    company: 'CloudNative Inc',
    avatarUrl:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
    similarityScore: 88,
    matchingTech: ['Go', 'Kubernetes', 'PostgreSQL', 'Redis'],
    experienceGap: 6,
    bio: 'DevOps & Site Reliability Engineer at scale. Happy to guide mentees on k8s operators, eBPF telemetry, and high-availability setups.',
    isAvailableNow: true,
    rating: 4.95,
    sessionsCompleted: 58,
  },
  {
    name: 'Chen Wei',
    username: 'chen_ai',
    role: 'Principal ML Engineer',
    company: 'Nexus AI',
    avatarUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
    similarityScore: 84,
    matchingTech: ['Python', 'Rust', 'WebAssembly', 'PyTorch'],
    experienceGap: 7,
    bio: 'Specialist in AST parsing, automated taint analysis, and client-side WASM transformer models.',
    isAvailableNow: false,
    rating: 4.89,
    sessionsCompleted: 29,
  },
];

export default function MentorshipPage() {
  const [mentors] = useState<MentorPairingProfile[]>(INITIAL_MENTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTech, setSelectedTech] = useState<string>('ALL');
  const [onlyAvailableNow, setOnlyAvailableNow] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState<number>(80);

  // Shadow Coding Session State
  const [shadowCodingMentor, setShadowCodingMentor] = useState<MentorPairingProfile | null>(null);
  const [shadowSessionMode, setShadowSessionMode] = useState<
    'CO_DEBUGGING' | 'CODE_REVIEW' | 'ARCHITECTURE'
  >('CO_DEBUGGING');

  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      if (m.similarityScore < minMatchScore) return false;
      if (onlyAvailableNow && !m.isAvailableNow) return false;

      if (selectedTech !== 'ALL' && !m.matchingTech.includes(selectedTech)) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.matchingTech.some((t) => t.toLowerCase().includes(q)) ||
        m.bio.toLowerCase().includes(q)
      );
    });
  }, [mentors, searchQuery, selectedTech, onlyAvailableNow, minMatchScore]);

  const handleLaunchShadowSession = (mentor: MentorPairingProfile) => {
    setShadowCodingMentor(mentor);
  };

  const handleConfirmShadowLaunch = () => {
    if (!shadowCodingMentor) return;
    const sessionId = `shadow_${Math.random().toString(16).substring(2, 8)}`;
    toast.success(`Shadow Coding Room Launched!`, {
      description: `Connected with @${shadowCodingMentor.username} in ${shadowSessionMode} mode.`,
    });
    setShadowCodingMentor(null);
  };

  const handleRequestMentorship = (mentor: MentorPairingProfile) => {
    toast.success(`Mentorship invitation sent to @${mentor.username}!`, {
      description: `Matched at ${mentor.similarityScore}% cosine overlap. They will reply within 24h.`,
    });
  };

  return (
    <div
      data-testid="mentorship-page-container"
      className="container mx-auto py-8 px-4 max-w-6xl space-y-8 text-slate-100"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
              MULTI-DIMENSIONAL COSINE MATCHING
            </span>
            <span className="text-xs text-slate-400 font-mono">AST & Git Verified</span>
          </div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 mt-1">
            <Users2 className="h-8 w-8 text-indigo-400" />
            Developer Mentorship & Pair Engine
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Pair with verified senior developers, launch live shadow-coding sessions, and accelerate your engineering mastery.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              aria-label="Available for Shadow Coding Now"
              checked={onlyAvailableNow}
              onChange={(e) => setOnlyAvailableNow(e.target.checked)}
              className="accent-emerald-500 cursor-pointer"
            />
            <span className="flex items-center gap-1.5 text-slate-200">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Live Available Now
            </span>
          </label>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="mentorship-search-input"
            placeholder="Search mentor by name, role, tech..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>

        {/* Tech Stack Filter Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {['ALL', 'TypeScript', 'Rust', 'Go', 'React', 'Kubernetes'].map((tech) => (
            <button
              key={tech}
              type="button"
              data-testid={`tech-filter-${tech}`}
              onClick={() => setSelectedTech(tech)}
              className={cn(
                'px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer border',
                selectedTech === tech
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
              )}
            >
              {tech}
            </button>
          ))}
        </div>
      </div>

      {/* Mentor Cards Grid */}
      <div
        data-testid="mentor-cards-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {filteredMentors.map((mentor) => (
          <MentorPairingCard
            key={mentor.username}
            mentor={mentor}
            onLaunchShadowCoding={handleLaunchShadowSession}
            onRequestMentorship={handleRequestMentorship}
          />
        ))}
      </div>

      {/* Shadow Coding Launch Modal */}
      {shadowCodingMentor && (
        <Dialog open={!!shadowCodingMentor} onOpenChange={(open) => !open && setShadowCodingMentor(null)}>
          <DialogContent
            data-testid="shadow-coding-launch-modal"
            className="max-w-md bg-[#0B0F19]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[28px] p-6 shadow-2xl"
          >
            <DialogHeader>
              <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>LIVE SHADOW CODING LAUNCHER</span>
              </div>
              <DialogTitle className="text-xl font-black text-white mt-1">
                Shadow Session with {shadowCodingMentor.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Synchronized Monaco Editor + WebRTC Voice Activity Channel.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Session Objective
                </label>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShadowSessionMode('CO_DEBUGGING')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left font-semibold transition-all cursor-pointer',
                      shadowSessionMode === 'CO_DEBUGGING'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    )}
                  >
                    <div className="font-bold text-white">Live Co-Debugging</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Tackle tricky production bugs and race conditions side-by-side.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShadowSessionMode('CODE_REVIEW')}
                    className={cn(
                      'p-2.5 rounded-xl border text-left font-semibold transition-all cursor-pointer',
                      shadowSessionMode === 'CODE_REVIEW'
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    )}
                  >
                    <div className="font-bold text-white">Interactive PR Walkthrough</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Walk line-by-line through pending architectural changes.
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShadowCodingMentor(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="confirm-shadow-launch-btn"
                  onClick={handleConfirmShadowLaunch}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 text-rose-400" />
                  <span>Launch Live Room</span>
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
