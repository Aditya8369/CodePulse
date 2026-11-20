'use client';

import React, { useState } from 'react';
import { Bookmark, Users, GitFork, Trash2, Tag, Edit3 } from 'lucide-react';

export default function BookmarksPage() {
  const [activeTab, setActiveTab] = useState<'DEVELOPER' | 'REPOSITORY'>('DEVELOPER');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState([
    {
      id: 'bm_1',
      targetType: 'DEVELOPER',
      targetId: 'alexmercer',
      title: 'Alex Mercer',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
      tags: ['mentor', 'typescript', 'rust'],
      notes: 'Staff Distributed Systems Engineer. Reached out for open source guidance.',
    },
    {
      id: 'bm_2',
      targetType: 'DEVELOPER',
      targetId: 'sarah_dev',
      title: 'Sarah Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop',
      tags: ['rival', 'frontend', 'tailwind'],
      notes: 'Competitive DevBattle rival in TypeScript Arena.',
    },
    {
      id: 'bm_3',
      targetType: 'REPOSITORY',
      targetId: 'codepulse/core',
      title: 'CodePulse Core Engine',
      avatarUrl: 'https://github.com/github.png',
      tags: ['inspiration', 'architecture'],
      notes: 'Clean NestJS module layout with Prisma integration.',
    },
  ]);

  const filteredBookmarks = bookmarks
    .filter(b => b.targetType === activeTab)
    .filter(b => (selectedTag ? b.tags.includes(selectedTag) : true));

  const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags)));

  const handleDelete = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
            <Bookmark className="h-8 w-8 text-primary" />
            Saved Bookmarks & Collections
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Curate your network of mentor engineers, battle rivals, and inspirational open-source repositories.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 bg-secondary p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('DEVELOPER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'DEVELOPER'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Developers
          </button>
          <button
            onClick={() => setActiveTab('REPOSITORY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'REPOSITORY'
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" /> Repositories
          </button>
        </div>
      </div>

      {/* Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1">
          <Tag className="w-3.5 h-3.5" /> Tags:
        </span>
        <button
          onClick={() => setSelectedTag(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium transition ${
            selectedTag === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          All
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium transition ${
              selectedTag === tag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* Bookmarks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBookmarks.map(bm => (
          <div
            key={bm.id}
            className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm hover:border-primary/40 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={bm.avatarUrl}
                    alt={bm.title}
                    className="w-12 h-12 rounded-full border border-border object-cover"
                  />
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{bm.title}</h4>
                    <span className="text-xs font-mono text-muted-foreground">@{bm.targetId}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(bm.id)}
                  className="text-muted-foreground hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {bm.notes && (
                <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border/60 text-xs text-muted-foreground flex items-start gap-2">
                  <Edit3 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{bm.notes}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
              {bm.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
