'use client';

import React, { useState } from 'react';
import { X, Sparkles, Eye, Code2 } from 'lucide-react';
import { addCustomChallenge } from '@/lib/custom-challenges';

interface CustomChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeCreated?: () => void;
}

export const CustomChallengeModal: React.FC<CustomChallengeModalProps> = ({
  isOpen,
  onClose,
  onChallengeCreated,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Frontend' | 'Backend' | 'Algorithm' | 'DevOps' | 'Documentation'>('Frontend');
  const [targetMetric, setTargetMetric] = useState('5 Commits');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required (up to 60 characters).');
      return;
    }

    const xpReward = difficulty === 'Easy' ? 50 : difficulty === 'Medium' ? 100 : 200;

    addCustomChallenge({
      id: `custom_${Date.now()}`,
      title: title.trim(),
      category,
      difficulty,
      xp: xpReward,
      progress: 0,
      target: parseInt(targetMetric) || 5,
      completed: false,
      deadline: '7 Days',
      description: description.trim() || 'Custom community challenge goal.',
    });

    if (onChallengeCreated) onChallengeCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground text-base">Create Custom Challenge</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-xs text-rose-400">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title (max 60 chars)</label>
            <input
              type="text"
              maxLength={60}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Refactor auth service to Zod"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
              >
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Algorithm">Algorithm</option>
                <option value="DevOps">DevOps</option>
                <option value="Documentation">Documentation</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as any)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
              >
                <option value="Easy">Easy (50 XP)</option>
                <option value="Medium">Medium (100 XP)</option>
                <option value="Hard">Hard (200 XP)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    activeTab === 'write' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    activeTab === 'preview' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {activeTab === 'write' ? (
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Markdown description of the challenge criteria..."
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary resize-none"
              />
            ) : (
              <div className="w-full mt-1 p-3 rounded-lg border border-border bg-background/50 text-xs text-foreground min-h-[75px] prose prose-invert">
                {description || <span className="text-muted-foreground">Nothing to preview</span>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow"
            >
              Save Challenge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
